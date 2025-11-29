import type { Chat, IdentifierRule } from '../types';
import { ProcessingStatus } from '../types';
import { updateChat } from './db';
import { createLogger } from './logger';

const log = createLogger('BatchService');

// Batch job status
export type BatchStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface BatchJob {
  id: string;
  chatIds: string[];
  status: BatchStatus;
  progress: number; // 0-100
  totalChats: number;
  processedChats: number;
  failedChats: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
}

// In-memory batch job storage (persisted to localStorage)
const BATCH_STORAGE_KEY = 'chatinsight-batch-jobs';
let batchJobs: BatchJob[] = [];
let batchUpdateCallbacks: ((jobs: BatchJob[]) => void)[] = [];

/**
 * Initialize batch service - load from localStorage
 */
export function initBatchService(): void {
  try {
    const stored = localStorage.getItem(BATCH_STORAGE_KEY);
    if (stored) {
      batchJobs = JSON.parse(stored);
      // Reset any "processing" jobs to "queued" on app restart
      batchJobs = batchJobs.map(job => ({
        ...job,
        status: job.status === 'processing' ? 'queued' : job.status
      }));
      saveBatchJobs();
    }
  } catch (e) {
    console.error('Failed to load batch jobs:', e);
    batchJobs = [];
  }
}

/**
 * Save batch jobs to localStorage
 */
function saveBatchJobs(): void {
  try {
    localStorage.setItem(BATCH_STORAGE_KEY, JSON.stringify(batchJobs));
  } catch (e) {
    console.error('Failed to save batch jobs:', e);
  }
}

/**
 * Subscribe to batch job updates
 */
export function onBatchUpdate(callback: (jobs: BatchJob[]) => void): () => void {
  batchUpdateCallbacks.push(callback);
  // Return unsubscribe function
  return () => {
    batchUpdateCallbacks = batchUpdateCallbacks.filter(cb => cb !== callback);
  };
}

/**
 * Notify all subscribers of batch updates
 */
function notifyBatchUpdate(): void {
  batchUpdateCallbacks.forEach(cb => cb([...batchJobs]));
}

/**
 * Get all batch jobs
 */
export function getBatchJobs(): BatchJob[] {
  return [...batchJobs];
}

/**
 * Get active (non-completed) batch jobs
 */
export function getActiveBatchJobs(): BatchJob[] {
  return batchJobs.filter(job => 
    job.status === 'queued' || job.status === 'processing'
  );
}

/**
 * Create a new batch job
 */
export function createBatchJob(chats: Chat[]): BatchJob {
  const job: BatchJob = {
    id: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    chatIds: chats.map(c => c.id),
    status: 'queued',
    progress: 0,
    totalChats: chats.length,
    processedChats: 0,
    failedChats: 0,
    createdAt: Date.now(),
  };

  log.info('Created new batch job', { 
    jobId: job.id, 
    totalChats: job.totalChats,
    chatIds: job.chatIds,
    chatFileNames: chats.map(c => c.fileName)
  });

  batchJobs.push(job);
  saveBatchJobs();
  notifyBatchUpdate();

  return job;
}

/**
 * Update a batch job
 */
export function updateBatchJob(jobId: string, updates: Partial<BatchJob>): BatchJob | null {
  const index = batchJobs.findIndex(job => job.id === jobId);
  if (index === -1) return null;

  batchJobs[index] = { ...batchJobs[index], ...updates };
  
  // Calculate progress
  const job = batchJobs[index];
  job.progress = job.totalChats > 0 
    ? Math.round(((job.processedChats + job.failedChats) / job.totalChats) * 100)
    : 0;

  saveBatchJobs();
  notifyBatchUpdate();

  return batchJobs[index];
}

/**
 * Cancel a batch job
 */
export function cancelBatchJob(jobId: string): boolean {
  const job = batchJobs.find(j => j.id === jobId);
  if (!job || job.status === 'completed' || job.status === 'cancelled') {
    return false;
  }

  updateBatchJob(jobId, { 
    status: 'cancelled',
    completedAt: Date.now()
  });

  return true;
}

/**
 * Remove completed/cancelled batch jobs
 */
export function clearCompletedBatches(): number {
  const before = batchJobs.length;
  batchJobs = batchJobs.filter(job => 
    job.status === 'queued' || job.status === 'processing'
  );
  saveBatchJobs();
  notifyBatchUpdate();
  return before - batchJobs.length;
}

/**
 * Process batch jobs sequentially
 * This simulates batch API behavior - in production, this would use the actual Gemini Batch API
 */
export async function processBatchJobs(
  rules: IdentifierRule[],
  analyzeFunction: (chat: Chat, rules: IdentifierRule[]) => Promise<Chat>
): Promise<void> {
  const queuedJobs = batchJobs.filter(job => job.status === 'queued');
  
  log.info('Starting batch processing', { 
    queuedJobsCount: queuedJobs.length,
    totalJobsCount: batchJobs.length 
  });
  
  for (const job of queuedJobs) {
    // Check if cancelled
    if (batchJobs.find(j => j.id === job.id)?.status === 'cancelled') {
      log.info('Job was cancelled, skipping', { jobId: job.id });
      continue;
    }

    log.info('Starting job processing', { 
      jobId: job.id, 
      totalChats: job.totalChats,
      chatIds: job.chatIds 
    });

    // Start processing
    updateBatchJob(job.id, {
      status: 'processing',
      startedAt: Date.now()
    });

    try {
      // Import db functions dynamically to avoid circular dependencies
      const { getChat } = await import('./db');

      for (let i = 0; i < job.chatIds.length; i++) {
        const chatId = job.chatIds[i];
        
        // Check if job was cancelled
        const currentJob = batchJobs.find(j => j.id === job.id);
        if (currentJob?.status === 'cancelled') {
          log.info('Job cancelled mid-processing', { jobId: job.id, processedSoFar: i });
          break;
        }

        log.debug('Processing chat', { 
          jobId: job.id, 
          chatId, 
          index: i + 1, 
          total: job.chatIds.length 
        });

        try {
          const chat = await getChat(chatId);
          
          if (!chat) {
            log.warn('Chat not found in database', { chatId, jobId: job.id });
            updateBatchJob(job.id, {
              failedChats: (currentJob?.failedChats || 0) + 1
            });
            continue;
          }
          
          if (chat.status === ProcessingStatus.DONE) {
            log.debug('Chat already processed, skipping', { chatId });
            updateBatchJob(job.id, {
              processedChats: (currentJob?.processedChats || 0) + 1
            });
            continue;
          }

          log.info('Analyzing chat with AI', { chatId, fileName: chat.fileName });
          
          const processedChat = await analyzeFunction(chat, rules);
          await updateChat(processedChat);
          
          log.info('Chat processed successfully', { 
            chatId, 
            fileName: chat.fileName,
            channel: processedChat.analysis?.channel,
            converted: processedChat.analysis?.converted
          });
          
          updateBatchJob(job.id, {
            processedChats: (currentJob?.processedChats || 0) + 1
          });
          
        } catch (error) {
          const errorObj = error as Error;
          log.error('Failed to process chat', errorObj, { 
            chatId, 
            jobId: job.id,
            errorMessage: errorObj.message 
          });
          
          updateBatchJob(job.id, {
            failedChats: (batchJobs.find(j => j.id === job.id)?.failedChats || 0) + 1
          });
        }

        // Small delay between chats to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
      }

      // Mark as completed
      const finalJob = batchJobs.find(j => j.id === job.id);
      if (finalJob?.status !== 'cancelled') {
        log.info('Job completed', { 
          jobId: job.id, 
          processedChats: finalJob?.processedChats,
          failedChats: finalJob?.failedChats,
          duration: finalJob?.startedAt ? Date.now() - finalJob.startedAt : 0
        });
        
        updateBatchJob(job.id, {
          status: 'completed',
          completedAt: Date.now()
        });
      }
    } catch (error) {
      const errorObj = error as Error;
      log.error('Batch job failed with critical error', errorObj, { 
        jobId: job.id,
        errorMessage: errorObj.message 
      });
      
      updateBatchJob(job.id, {
        status: 'failed',
        error: errorObj.message,
        completedAt: Date.now()
      });
    }
  }
  
  log.info('Batch processing cycle completed');
}

/**
 * Get batch statistics summary
 */
export function getBatchStats(): {
  total: number;
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  totalChats: number;
  processedChats: number;
} {
  return {
    total: batchJobs.length,
    queued: batchJobs.filter(j => j.status === 'queued').length,
    processing: batchJobs.filter(j => j.status === 'processing').length,
    completed: batchJobs.filter(j => j.status === 'completed').length,
    failed: batchJobs.filter(j => j.status === 'failed').length,
    totalChats: batchJobs.reduce((sum, j) => sum + j.totalChats, 0),
    processedChats: batchJobs.reduce((sum, j) => sum + j.processedChats, 0),
  };
}

// Initialize on module load
initBatchService();
