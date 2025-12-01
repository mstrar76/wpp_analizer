import type { Chat, IdentifierRule } from '../types';
import { ProcessingStatus } from '../types';
import { analyzeChat } from './gemini';
import { updateChat, getChatsByStatus } from './db';
import { createLogger } from './logger';

// Queue configuration
// Gemini 2.5 Flash Tier 1: 1000 RPM (approx 16 requests/sec)
const DEFAULT_BATCH_SIZE = 10; // Optimized for Tier 1
const BATCH_MODE_SIZE = 3; // Safe fallback
const DEFAULT_BATCH_DELAY_MS = 200; // Aggressive scheduling (5 batches/sec theoretical max)
const BATCH_MODE_DELAY_MS = 1000;
const MAX_RETRIES = 2;

// Adaptive Rate Limiting State
let isRateLimited = false;
let rateLimitBackoffMs = 5000; // Start with 5s backoff
const MAX_BACKOFF_MS = 60000; // Max 1 minute backoff

const log = createLogger('processingQueue');

function triggerRateLimitBackoff() {
  if (!isRateLimited) {
    isRateLimited = true;
    log.info('Rate limit hit. Pausing queue.', { backoffMs: rateLimitBackoffMs });
    
    // Reset backoff after successful period? implemented in processQueue
    setTimeout(() => {
      isRateLimited = false;
      // Increase backoff for next time if we hit it again quickly
      rateLimitBackoffMs = Math.min(rateLimitBackoffMs * 2, MAX_BACKOFF_MS);
      log.info('Resuming queue after backoff.');
    }, rateLimitBackoffMs);
  }
}

function resetRateLimitBackoff() {
  if (rateLimitBackoffMs > 5000) {
    rateLimitBackoffMs = 5000; // Reset to base
  }
}

// Batch mode configuration (economical mode for large imports)
let batchModeEnabled = false;

export function setBatchMode(enabled: boolean): void {
  batchModeEnabled = enabled;
}

export function isBatchModeEnabled(): boolean {
  return batchModeEnabled;
}

function getBatchSettings() {
  return batchModeEnabled
    ? { size: BATCH_MODE_SIZE, delay: BATCH_MODE_DELAY_MS }
    : { size: DEFAULT_BATCH_SIZE, delay: DEFAULT_BATCH_DELAY_MS };
}

// Queue state
let isProcessing = false;

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
    log.info('Starting chat processing', {
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

    log.info('Chat processed successfully', {
      chatId: chat.id,
      processedAt: chat.processedAt,
    });
  } catch (error: any) {
    log.error('Error processing chat', error, {
      chatId: chat.id,
      retryCount,
      errorMessage: error?.message,
      stack: error?.stack,
    });

    // Check for Rate Limit (429)
    if (error.message?.includes('429') || error.message?.includes('Rate limit')) {
       triggerRateLimitBackoff();
       // Do not retry immediately; let the queue loop handle the pause.
       // But we need to put this chat back to PENDING so it gets picked up again.
       chat.status = ProcessingStatus.PENDING; 
       chat.error = undefined; // Clear error so it looks like fresh pending
       await updateChat(chat);
       await notifyProgress();
       return; 
    }

    // Retry logic (for non-rate-limit errors)
    if (retryCount < MAX_RETRIES && !error.message.includes('Invalid API key')) {
      log.info('Retrying chat processing', {
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

    log.error('Chat marked as failed', undefined, {
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
    const { size: batchSize, delay: batchDelay } = getBatchSettings();
    let pendingChats = await getChatsByStatus(ProcessingStatus.PENDING);
    let successfulBatches = 0;

    while (pendingChats.length > 0) {
      // Check for Rate Limit Pause
      if (isRateLimited) {
        log.info(`Queue paused for rate limit backoff (${rateLimitBackoffMs}ms)...`);
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Check every second
        continue; // Loop again to check if paused flag is cleared
      }

      // Get batch
      const batch = pendingChats.slice(0, batchSize);
      
      log.info('Processing batch', {
        batchSize: batch.length,
        totalPending: pendingChats.length,
        batchModeEnabled,
      });

      // Process batch
      await processBatch(batch, rules);
      
      // Adaptive improvement: If batch succeeded without rate limits, decrement backoff
      if (!isRateLimited) {
        successfulBatches++;
        if (successfulBatches > 5) { // After 5 good batches, reset backoff safety
           resetRateLimitBackoff();
           successfulBatches = 0;
        }
      }

      // Wait before next batch (rate limiting)
      if (pendingChats.length > batchSize) {
        await new Promise((resolve) => setTimeout(resolve, batchDelay));
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
    log.error('Queue processing error', error as Error, {
      errorMessage: (error as Error)?.message,
      stack: (error as Error)?.stack,
    });
  } finally {
    isProcessing = false;
    await notifyProgress();
    log.info('Queue processing finished');
  }
}

/**
 * Start processing all pending chats
 */
export async function startProcessing(rules: IdentifierRule[]): Promise<void> {
  if (isProcessing) {
    log.info('Queue already processing');
    return;
  }

  log.info('Starting queue processing');
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
  const { size: batchSize, delay: batchDelay } = getBatchSettings();
  const batchCount = Math.ceil(stats.pending / batchSize);
  const totalBatchDelay = (batchCount - 1) * (batchDelay / 1000);
  
  return (stats.pending * avgTimePerChat) + totalBatchDelay;
}
