import type { ChatMessage, RawChatFile } from '../types';

/**
 * Multiple WhatsApp export formats:
 * - [dd/mm/yy, hh:mm:ss] Sender: Message (with brackets)
 * - [dd/mm/yyyy, hh:mm:ss] Sender: Message
 * - dd/mm/yy hh:mm - Sender: Message (without brackets, Brazilian format)
 * - dd/mm/yyyy hh:mm - Sender: Message
 * - dd/mm/yy, hh:mm - Sender: Message
 */
const WHATSAPP_FORMATS = [
  // Format with brackets: [dd/mm/yy, hh:mm:ss] Sender: Message
  /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s(\d{1,2}:\d{2}(?::\d{2})?)\]\s([^:]+):\s(.+)$/,
  // Format without brackets: dd/mm/yy hh:mm - Sender: Message
  /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s(\d{1,2}:\d{2}(?::\d{2})?)\s-\s([^:]+):\s(.+)$/,
  // Format with dash separator: dd/mm/yy, hh:mm - Sender: Message  
  /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s(\d{1,2}:\d{2}(?::\d{2})?)\s+-\s+([^:]+):\s*(.+)$/,
];

/**
 * Custom format regex for block-based exports:
 * 2023-02-19 20:56:30 from CK7uyp8GIAA= (+554197215164) - Lida
 * 2023-02-19 20:56:30 to +55 41 99721-5164 - Lida
 * 2023-02-19 20:56:30 from Marcos Roberto Ipad 6 (+554199472882) - Lida
 * 2023-02-19 20:56:30 notification
 */
const CUSTOM_BLOCK_HEADER_REGEX = /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+(from|to|notification)\s*(.*)$/i;

/**
 * Parse a single WhatsApp message line (standard format)
 */
function parseMessageLine(line: string): ChatMessage | null {
  let match: RegExpMatchArray | null = null;
  
  // Try each format until one matches
  for (const regex of WHATSAPP_FORMATS) {
    match = line.match(regex);
    if (match) break;
  }
  
  if (!match) {
    return null;
  }

  const [, dateStr, timeStr, sender, content] = match;
  
  try {
    // Parse date (dd/mm/yy or dd/mm/yyyy)
    const [day, month, year] = dateStr.split('/').map(Number);
    const fullYear = year < 100 ? 2000 + year : year;
    
    // Parse time (hh:mm or hh:mm:ss)
    const timeParts = timeStr.split(':').map(Number);
    const hours = timeParts[0];
    const minutes = timeParts[1];
    const seconds = timeParts[2] || 0;
    
    // Create date object (month is 0-indexed in JavaScript)
    const date = new Date(fullYear, month - 1, day, hours, minutes, seconds);
    
    return {
      date,
      sender: sender.trim(),
      content: content.trim(),
    };
  } catch (error) {
    console.error('Error parsing message date:', error);
    return null;
  }
}

/**
 * Parse custom block-based format:
 * ----------------------------------------------------
 * +55 41 99721-5164
 * 2023-02-19 20:56:30 from CK7uyp8GIAA= (+554197215164) - Lida
 * 
 * message content here
 * 
 * ----------------------------------------------------
 */
function parseCustomBlockFormat(content: string): ChatMessage[] {
  const messages: ChatMessage[] = [];
  
  // Split by separator line
  const blocks = content.split(/^-{20,}$/m);
  
  for (const block of blocks) {
    const lines = block.trim().split('\n').map(l => l.trim()).filter(l => l);
    
    if (lines.length < 2) continue;
    
    // Look for the timestamp line: 2023-02-19 20:56:30 from/to/notification ...
    let timestampLine = '';
    let timestampLineIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
      if (CUSTOM_BLOCK_HEADER_REGEX.test(lines[i])) {
        timestampLine = lines[i];
        timestampLineIndex = i;
        break;
      }
    }
    
    if (!timestampLine || timestampLineIndex === -1) continue;
    
    const match = timestampLine.match(CUSTOM_BLOCK_HEADER_REGEX);
    if (!match) continue;
    
    const [, dateStr, timeStr, direction, senderInfo] = match;
    
    // Skip notification messages
    if (direction.toLowerCase() === 'notification') continue;
    
    // Extract sender from senderInfo
    // Format: "CK7uyp8GIAA= (+554197215164) - Lida" or "Marcos Roberto (+554199472882) - Lida" or "+55 41 99721-5164 - Lida"
    let sender = senderInfo;
    
    // Try to extract phone number from parentheses or use the whole thing
    const phoneMatch = senderInfo.match(/\((\+?\d+)\)/);
    if (phoneMatch) {
      sender = phoneMatch[1];
    } else {
      // Remove status suffix like "- Lida", "- Recebida", "- Entregue"
      sender = senderInfo.replace(/\s*-\s*(Lida|Recebida|Entregue|Reproduzida).*$/i, '').trim();
    }
    
    // Mark direction (from = customer, to = business)
    const isFromCustomer = direction.toLowerCase() === 'from';
    
    // Get message content (lines after the timestamp line)
    const messageLines = lines.slice(timestampLineIndex + 1);
    const messageContent = messageLines.join('\n').trim();
    
    // Skip empty messages
    if (!messageContent) continue;
    
    try {
      // Parse date (yyyy-mm-dd)
      const [year, month, day] = dateStr.split('-').map(Number);
      
      // Parse time (hh:mm:ss)
      const [hours, minutes, seconds] = timeStr.split(':').map(Number);
      
      const date = new Date(year, month - 1, day, hours, minutes, seconds);
      
      messages.push({
        date,
        sender: isFromCustomer ? sender : 'Atendente',
        content: messageContent,
      });
    } catch (error) {
      console.error('Error parsing custom block:', error);
    }
  }
  
  return messages;
}

/**
 * Detect which format the content is in
 */
function detectFormat(content: string): 'standard' | 'custom-block' {
  // Check for custom block format (has separator lines with 20+ dashes)
  // and timestamp lines like "2023-02-19 20:56:30 from/to/notification"
  const hasSeparators = /^-{20,}$/m.test(content);
  const hasCustomTimestamp = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s+(from|to|notification)/m.test(content);
  
  if (hasSeparators && hasCustomTimestamp) {
    return 'custom-block';
  }
  return 'standard';
}

/**
 * Parse WhatsApp chat file content
 * @param content - The raw text content of the WhatsApp export
 * @param fileName - The name to use for this chat (folder name or file name)
 */
export function parseWhatsAppChat(content: string, fileName: string): RawChatFile | null {
  // Detect format and parse accordingly
  const format = detectFormat(content);
  console.log('Detected format:', format, 'for file:', fileName);
  
  let messages: ChatMessage[] = [];
  
  if (format === 'custom-block') {
    // Parse custom block format
    messages = parseCustomBlockFormat(content);
  } else {
    // Parse standard WhatsApp format
    const lines = content.split('\n');
    let currentMessage: ChatMessage | null = null;

    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines
      if (!trimmedLine) {
        continue;
      }

      // Try to parse as a new message
      const parsedMessage = parseMessageLine(trimmedLine);
      
      if (parsedMessage) {
        // Save previous message if exists
        if (currentMessage) {
          messages.push(currentMessage);
        }
        currentMessage = parsedMessage;
      } else if (currentMessage) {
        // This is a continuation of the previous message (multi-line message)
        currentMessage.content += '\n' + trimmedLine;
      }
    }

    // Add the last message
    if (currentMessage) {
      messages.push(currentMessage);
    }
  }

  console.log('Parsed messages count:', messages.length);

  // If no messages were parsed, return null
  if (messages.length === 0) {
    return null;
  }

  // Get timestamp from first message
  const timestamp = messages[0]?.date.getTime();

  return {
    id: crypto.randomUUID(),
    fileName,
    content,
    messages,
    timestamp,
    uploadedAt: Date.now(),
  };
}

/**
 * Parse multiple WhatsApp chat files
 */
export function parseWhatsAppChats(files: File[]): Promise<RawChatFile[]> {
  return Promise.all(
    files.map(async (file) => {
      try {
        const content = await file.text();
        const parsed = parseWhatsAppChat(content, file.name);
        return parsed;
      } catch (error) {
        console.error(`Error reading file ${file.name}:`, error);
        return null;
      }
    })
  ).then((results) => results.filter((r): r is RawChatFile => r !== null));
}

/**
 * Validate if a file is a valid WhatsApp export
 */
export function isValidWhatsAppFile(content: string): boolean {
  const lines = content.split('\n').slice(0, 10); // Check first 10 lines
  return lines.some((line) => {
    const trimmed = line.trim();
    return WHATSAPP_FORMATS.some(regex => regex.test(trimmed));
  });
}

/**
 * Extract conversation metadata
 */
export function extractConversationMetadata(messages: ChatMessage[]): {
  participants: string[];
  messageCount: number;
  dateRange: { start: Date; end: Date } | null;
  avgMessagesPerParticipant: number;
} {
  if (messages.length === 0) {
    return {
      participants: [],
      messageCount: 0,
      dateRange: null,
      avgMessagesPerParticipant: 0,
    };
  }

  const participants = Array.from(new Set(messages.map((m) => m.sender)));
  const messageCount = messages.length;
  
  const dates = messages.map((m) => m.date);
  const dateRange = {
    start: new Date(Math.min(...dates.map((d) => d.getTime()))),
    end: new Date(Math.max(...dates.map((d) => d.getTime()))),
  };

  const avgMessagesPerParticipant = messageCount / participants.length;

  return {
    participants,
    messageCount,
    dateRange,
    avgMessagesPerParticipant,
  };
}

/**
 * Format messages back to WhatsApp export format (for debugging/export)
 */
export function formatToWhatsAppExport(messages: ChatMessage[]): string {
  return messages
    .map((msg) => {
      const date = msg.date;
      if (!(date instanceof Date) || isNaN(date.getTime())) {
        console.error(`formatToWhatsAppExport: Invalid Date object for msg: ${JSON.stringify(msg)}. Type: ${typeof date}, Value: ${date}`);
        // Use a placeholder or throw a more specific error
        return `[INVALID_DATE: ${typeof date}] ${msg.sender}: ${msg.content}`;
      }
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = String(date.getFullYear()).slice(-2);
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      
      return `[${day}/${month}/${year}, ${hours}:${minutes}:${seconds}] ${msg.sender}: ${msg.content}`;
    })
    .join('\n');
}
