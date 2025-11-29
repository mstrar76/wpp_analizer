import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { onProgress, getQueueStats, type QueueStats } from '../services/processingQueue';

interface ProgressButtonProps {
  onClick: () => void;
  disabled?: boolean;
  isActive?: boolean;
  label: string;
  activeLabel: string;
  className?: string;
}

/**
 * Button with progress fill overlay showing processing percentage
 */
export default function ProgressButton({
  onClick,
  disabled = false,
  isActive = false,
  label,
  activeLabel,
  className = '',
}: ProgressButtonProps) {
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [initialPending, setInitialPending] = useState<number | null>(null);

  useEffect(() => {
    // Get initial stats
    getQueueStats().then((s) => {
      setStats(s);
      if (s.isProcessing && initialPending === null) {
        setInitialPending(s.pending + (s.total - s.processed - s.failed - s.pending));
      }
    });

    // Subscribe to progress updates
    onProgress((newStats) => {
      setStats(newStats);
      
      // Track initial pending count when processing starts
      if (newStats.isProcessing && initialPending === null) {
        setInitialPending(newStats.pending);
      }
      
      // Reset when processing completes
      if (!newStats.isProcessing) {
        setInitialPending(null);
      }
    });
  }, [initialPending]);

  const isProcessing = stats?.isProcessing || false;
  const showProgress = isProcessing && isActive;
  
  // Calculate percentage based on initial pending count
  const percentage = showProgress && initialPending && initialPending > 0
    ? Math.round(((initialPending - (stats?.pending || 0)) / initialPending) * 100)
    : 0;

  return (
    <button
      onClick={onClick}
      disabled={disabled || isProcessing}
      className={`relative overflow-hidden btn-secondary flex items-center gap-2 ${className}`}
    >
      {/* Progress fill background */}
      {showProgress && (
        <div
          className="absolute inset-0 bg-blue-200 transition-all duration-300 ease-out"
          style={{ width: `${percentage}%` }}
        />
      )}
      
      {/* Button content */}
      <span className="relative z-10 flex items-center gap-2">
        <RefreshCw className={isProcessing ? 'animate-spin' : ''} size={18} />
        {isProcessing ? (
          <span>
            {activeLabel}
            {showProgress && ` (${percentage}%)`}
          </span>
        ) : (
          label
        )}
      </span>
    </button>
  );
}
