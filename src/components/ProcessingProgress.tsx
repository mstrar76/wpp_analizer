import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { onProgress, getQueueStats, type QueueStats } from '../services/processingQueue';

interface ProcessingProgressProps {
  /** Show as a compact inline indicator */
  compact?: boolean;
  /** Custom class name */
  className?: string;
}

/**
 * Displays real-time processing progress with percentage bar
 */
export default function ProcessingProgress({ compact = false, className = '' }: ProcessingProgressProps) {
  const [stats, setStats] = useState<QueueStats | null>(null);

  useEffect(() => {
    // Get initial stats
    getQueueStats().then(setStats);

    // Subscribe to progress updates
    onProgress((newStats) => {
      setStats(newStats);
    });
  }, []);

  if (!stats || !stats.isProcessing) {
    return null;
  }

  const totalToProcess = stats.total - stats.processed - stats.failed + stats.pending;
  const processedInSession = totalToProcess > 0 ? totalToProcess - stats.pending : 0;
  const percentage = totalToProcess > 0 
    ? Math.round((processedInSession / totalToProcess) * 100) 
    : 0;

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Loader2 className="animate-spin text-blue-600" size={16} />
        <span className="text-sm text-gray-600">{percentage}%</span>
      </div>
    );
  }

  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Loader2 className="animate-spin text-blue-600" size={18} />
          <span className="font-medium text-blue-900">Processing chats...</span>
        </div>
        <span className="text-sm font-semibold text-blue-700">{percentage}%</span>
      </div>
      
      <div className="w-full bg-blue-200 rounded-full h-2.5 overflow-hidden">
        <div 
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      <div className="flex justify-between mt-2 text-xs text-blue-700">
        <span>{stats.pending} pending</span>
        <span>{stats.processed} done • {stats.failed} failed</span>
      </div>
    </div>
  );
}
