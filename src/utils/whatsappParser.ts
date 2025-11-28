import type { ChatMessage, RawChatFile } from '../types';

/**
 * Parse WhatsApp export format: [dd/mm/yy, hh:mm:ss] Sender: Message
 * Also supports alternative formats: [dd/mm/yyyy, hh:mm:ss] or [dd/mm/yy hh:mm:ss]
 */
const WHATSAPP_MESSAGE_REGEX = /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s(\d{1,2}:\d{2}(?::\d{2})?)\]\s([^:]+):\s(.+)$/;

/**
 * Parse a single WhatsApp message line
 */
function parseMessageLine(line: string): ChatMessage | null {
  const match = line.match(WHATSAPP_MESSAGE_REGEX);
  
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
 * Parse WhatsApp chat file content
 */
export function parseWhatsAppChat(fileName: string, content: string): RawChatFile | null {
  const lines = content.split('\n');
  const messages: ChatMessage[] = [];
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
        const parsed = parseWhatsAppChat(file.name, content);
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
  return lines.some((line) => WHATSAPP_MESSAGE_REGEX.test(line.trim()));
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
