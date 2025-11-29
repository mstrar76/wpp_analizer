import type { Chat, IdentifierRule } from '../types';
import { ProcessingStatus } from '../types';
import { analyzeChat } from './gemini';
import { updateChat, getChatsByStatus } from './db';

// Queue configuration
// Gemini 2.5 Flash: Free tier 10 RPM, Tier 1: 1000 RPM, Tier 2: 2000 RPM
const BATCH_SIZE = 5; // Process 5 chats concurrently (optimized for paid tier)
const BATCH_DELAY_MS = 500; // 500ms between batches for faster processing
const MAX_RETRIES = 2; // Retry failed analyses

// Batch mode configuration (economical mode for large imports)
let batchModeEnabled = false;

export function setBatchMode(enabled: boolean): void {
  batchModeEnabled = enabled;
}

export function isBatchModeEnabled(): boolean {
  return batchModeEnabled;
}

// Queue state
let isProcessing = false;

const SERVICE_NAME = 'processingQueue';

function logQueueEvent(
  level: 'info' | 'error',
  message: string,
  data: Record<string, unknown> = {}
): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    service: SERVICE_NAME,
    message,
    ...data,
  };
  console[level === 'error' ? 'error' : 'log'](JSON.stringify(logEntry));
}

// Event callbacks
type QueueCallback = (stats: QueueStats) => void;
let onProgressCallback: QueueCallback | null = null;
let onCompleteCallback: QueueCallback | null = null;

export interface QueueStats {
  total: number;
  processed: number;
  failed: number;
  pending: number;
  isProcessing: boolean;
}

/**
 * Set progress callback
 */
export function onProgress(callback: QueueCallback): void {
  onProgressCallback = callback;
}

/**
 * Set completion callback
 */
export function onComplete(callback: QueueCallback): void {
  onCompleteCallback = callback;
}

/**
 * Get current queue statistics
 */
export async function getQueueStats(): Promise<QueueStats> {
  const pendingChats = await getChatsByStatus(ProcessingStatus.PENDING);
  const processingChats = await getChatsByStatus(ProcessingStatus.PROCESSING);
  const doneChats = await getChatsByStatus(ProcessingStatus.DONE);
  const failedChats = await getChatsByStatus(ProcessingStatus.FAILED);

  return {
    total: pendingChats.length + processingChats.length + doneChats.length + failedChats.length,
    processed: doneChats.length,
    failed: failedChats.length,
    pending: pendingChats.length + processingChats.length,
    isProcessing,
  };
}

/**
 * Notify progress
 */
async function notifyProgress(): Promise<void> {
  if (onProgressCallback) {
    const stats = await getQueueStats();
    onProgressCallback(stats);
  }
}

/**
 * Process a single chat
 */
async function processSingleChat(
  chat: Chat,
  rules: IdentifierRule[],
  retryCount = 0
): Promise<void> {
  try {
    logQueueEvent('info', 'Starting chat processing', {
      chatId: chat.id,
      retryCount,
    });

    // Update status to processing
    chat.status = ProcessingStatus.PROCESSING;
    await updateChat(chat);
    await notifyProgress();

    // Analyze the chat
    const analysis = await analyzeChat(chat.messages, rules);

    // Update chat with analysis results
    chat.analysis = analysis;
    chat.status = ProcessingStatus.DONE;
    chat.processedAt = Date.now();
    chat.error = undefined;
    
    await updateChat(chat);
    await notifyProgress();

    logQueueEvent('info', 'Chat processed successfully', {
      chatId: chat.id,
      processedAt: chat.processedAt,
    });
  } catch (error: any) {
    logQueueEvent('error', 'Error processing chat', {
      chatId: chat.id,
      retryCount,
      errorMessage: error?.message,
      stack: error?.stack,
    });

    // Retry logic
    if (retryCount < MAX_RETRIES && !error.message.includes('Invalid API key')) {
      logQueueEvent('info', 'Retrying chat processing', {
        chatId: chat.id,
        nextAttempt: retryCount + 1,
        maxRetries: MAX_RETRIES,
      });
      await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2s before retry
      return processSingleChat(chat, rules, retryCount + 1);
    }

    // Mark as failed
    chat.status = ProcessingStatus.FAILED;
    chat.error = error.message || 'Unknown error';
    await updateChat(chat);
    await notifyProgress();

    logQueueEvent('error', 'Chat marked as failed', {
      chatId: chat.id,
      finalError: chat.error,
    });
  }
}

/**
 * Process a batch of chats
 */
async function processBatch(
  chats: Chat[],
  rules: IdentifierRule[]
): Promise<void> {
  await Promise.all(
    chats.map((chat) => processSingleChat(chat, rules))
  );
}

/**
 * Main queue processing loop
 */
async function processQueue(rules: IdentifierRule[]): Promise<void> {
  if (isProcessing) {
    return;
  }

  isProcessing = true;

  try {
    let pendingChats = await getChatsByStatus(ProcessingStatus.PENDING);

    while (pendingChats.length > 0) {
      // Get batch
      const batch = pendingChats.slice(0, BATCH_SIZE);
      
      logQueueEvent('info', 'Processing batch', {
        batchSize: batch.length,
        totalPending: pendingChats.length,
      });

      // Process batch
      await processBatch(batch, rules);

      // Wait before next batch (rate limiting)
      if (pendingChats.length > BATCH_SIZE) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }

      // Get updated pending chats
      pendingChats = await getChatsByStatus(ProcessingStatus.PENDING);
    }

    // Notify completion
    if (onCompleteCallback) {
      const stats = await getQueueStats();
      onCompleteCallback(stats);
    }
  } catch (error) {
    logQueueEvent('error', 'Queue processing error', {
      errorMessage: (error as Error)?.message,
      stack: (error as Error)?.stack,
    });
  } finally {
    isProcessing = false;
    await notifyProgress();
    logQueueEvent('info', 'Queue processing finished');
  }
}

/**
 * Start processing all pending chats
 */
export async function startProcessing(rules: IdentifierRule[]): Promise<void> {
  if (isProcessing) {
    logQueueEvent('info', 'Queue already processing');
    return;
  }

  logQueueEvent('info', 'Starting queue processing');
  await processQueue(rules);
}

/**
 * Stop processing (gracefully finish current batch)
 */
export function stopProcessing(): void {
  isProcessing = false;
}

/**
 * Check if queue is currently processing
 */
export function isQueueProcessing(): boolean {
  return isProcessing;
}

/**
 * Add chats to the queue
 */
export async function addToQueue(chats: Chat[]): Promise<void> {
  // Mark chats as pending if they're new
  const chatsToUpdate = chats.map((chat) => ({
    ...chat,
    status: chat.status === ProcessingStatus.DONE ? ProcessingStatus.DONE : ProcessingStatus.PENDING,
  }));

  for (const chat of chatsToUpdate) {
    await updateChat(chat);
  }

  await notifyProgress();
}

/**
 * Reprocess all chats (reset to pending and start processing)
 */
export async function reprocessAllChats(rules: IdentifierRule[]): Promise<void> {
  // This function will be called from the Settings page
  // It resets all chats to pending status and restarts processing
  
  const { getAllChats, updateChats } = await import('./db');
  const allChats = await getAllChats();
  
  const resettedChats = allChats.map((chat) => ({
    ...chat,
    status: ProcessingStatus.PENDING,
    analysis: undefined,
    error: undefined,
    processedAt: undefined,
  }));

  await updateChats(resettedChats);
  await notifyProgress();
  
  // Start processing
  await startProcessing(rules);
}

/**
 * Reprocess only failed chats
 */
export async function reprocessFailedChats(rules: IdentifierRule[]): Promise<void> {
  const { getAllChats, updateChats } = await import('./db');
  const allChats = await getAllChats();

  const failedChats = allChats.filter((chat) => chat.status === ProcessingStatus.FAILED);

  if (failedChats.length === 0) {
    throw new Error('No failed chats to reprocess.');
  }

  const resettedChats = failedChats.map((chat) => ({
    ...chat,
    status: ProcessingStatus.PENDING,
    analysis: undefined,
    error: undefined,
    processedAt: undefined,
  }));

  await updateChats(resettedChats);
  await notifyProgress();

  await startProcessing(rules);
}

/**
 * Get estimated time remaining
 */
export async function getEstimatedTimeRemaining(): Promise<number> {
  const stats = await getQueueStats();
  
  if (stats.pending === 0) {
    return 0;
  }

  // Average 3-5 seconds per chat + batch delays
  const avgTimePerChat = 4; // seconds
  const batchCount = Math.ceil(stats.pending / BATCH_SIZE);
  const totalBatchDelay = (batchCount - 1) * (BATCH_DELAY_MS / 1000);
  
  return (stats.pending * avgTimePerChat) + totalBatchDelay;
}
