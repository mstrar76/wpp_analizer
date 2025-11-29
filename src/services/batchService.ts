import type { Chat, IdentifierRule } from '../types';
import { createLogger } from './logger';

const log = createLogger('BatchService');

export type BatchStatus = 'queued' | 'uploading' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface BatchJob {
  id: string;
  chatIds: string[];
  status: BatchStatus;
  progress: number;
  totalChats: number;
  processedChats: number;
  failedChats: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string;
  googleBatchId?: string;
  googleFileUri?: string;
}

const STORAGE_KEY = 'chatinsight_batch_jobs';

let batchJobs: BatchJob[] = loadBatchJobs();
let updateCallbacks: ((jobs: BatchJob[]) => void)[] = [];

function loadBatchJobs(): BatchJob[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    return [];
  }
}

function saveBatchJobs() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(batchJobs));
  } catch (e) {
    console.error('Failed to save batch jobs:', e);
  }
}

export function onBatchUpdate(callback: (jobs: BatchJob[]) => void): () => void {
  updateCallbacks.push(callback);
  return () => {
    updateCallbacks = updateCallbacks.filter(cb => cb !== callback);
  };
}

function notifyBatchUpdate() {
  updateCallbacks.forEach(cb => cb([...batchJobs]));
}

export function getBatchJobs(): BatchJob[] {
  return [...batchJobs];
}

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

  log.info('Created new batch job', { jobId: job.id, totalChats: job.totalChats });
  batchJobs.push(job);
  saveBatchJobs();
  notifyBatchUpdate();
  return job;
}

export async function processBatchJobs(_rules: IdentifierRule[]): Promise<void> {
  // Batch processing is currently disabled
  // This is a placeholder for future implementation
  log.info('Batch processing not yet implemented');
}

export async function cancelBatchJob(id: string): Promise<void> {
  const index = batchJobs.findIndex(j => j.id === id);
  if (index !== -1) {
    batchJobs[index].status = 'cancelled';
    batchJobs[index].completedAt = Date.now();
    saveBatchJobs();
    notifyBatchUpdate();
    log.info('Batch job cancelled', { jobId: id });
  }
}

export function clearCompletedBatches(): number {
  const before = batchJobs.length;
  batchJobs = batchJobs.filter(job => 
    ['queued', 'uploading', 'processing'].includes(job.status)
  );
  saveBatchJobs();
  notifyBatchUpdate();
  return before - batchJobs.length;
}
