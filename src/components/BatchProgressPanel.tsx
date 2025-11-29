import { useState, useEffect } from 'react';
import { Clock, CheckCircle, AlertCircle, XCircle, Loader2, Trash2, X } from 'lucide-react';
import { 
  onBatchUpdate, 
  getBatchJobs, 
  cancelBatchJob, 
  clearCompletedBatches,
  type BatchJob,
  type BatchStatus
} from '../services/batchService';

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatDuration(start: number, end?: number): string {
  const duration = (end || Date.now()) - start;
  const seconds = Math.floor(duration / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

function getStatusIcon(status: BatchStatus) {
  switch (status) {
    case 'queued':
      return <Clock className="text-gray-500" size={18} />;
    case 'processing':
      return <Loader2 className="text-blue-600 animate-spin" size={18} />;
    case 'completed':
      return <CheckCircle className="text-green-600" size={18} />;
    case 'failed':
      return <AlertCircle className="text-red-600" size={18} />;
    case 'cancelled':
      return <XCircle className="text-gray-400" size={18} />;
  }
}

function getStatusText(status: BatchStatus): string {
  switch (status) {
    case 'queued':
      return 'Na fila';
    case 'processing':
      return 'Processando';
    case 'completed':
      return 'Concluído';
    case 'failed':
      return 'Falhou';
    case 'cancelled':
      return 'Cancelado';
  }
}

function getStatusColor(status: BatchStatus): string {
  switch (status) {
    case 'queued':
      return 'bg-gray-100 text-gray-700';
    case 'processing':
      return 'bg-blue-100 text-blue-700';
    case 'completed':
      return 'bg-green-100 text-green-700';
    case 'failed':
      return 'bg-red-100 text-red-700';
    case 'cancelled':
      return 'bg-gray-100 text-gray-500';
  }
}

interface BatchProgressPanelProps {
  className?: string;
}

export default function BatchProgressPanel({ className = '' }: BatchProgressPanelProps) {
  const [jobs, setJobs] = useState<BatchJob[]>(getBatchJobs());
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    // Subscribe to batch updates
    const unsubscribe = onBatchUpdate((updatedJobs) => {
      setJobs(updatedJobs);
    });

    return unsubscribe;
  }, []);

  const activeJobs = jobs.filter(j => j.status === 'queued' || j.status === 'processing');
  const completedJobs = jobs.filter(j => j.status === 'completed' || j.status === 'failed' || j.status === 'cancelled');

  const handleCancel = (jobId: string) => {
    cancelBatchJob(jobId);
  };

  const handleClearCompleted = () => {
    clearCompletedBatches();
  };

  if (jobs.length === 0) {
    return null;
  }

  // Calculate overall progress
  const totalChats = jobs.reduce((sum, j) => sum + j.totalChats, 0);
  const processedChats = jobs.reduce((sum, j) => sum + j.processedChats + j.failedChats, 0);
  const overallProgress = totalChats > 0 ? Math.round((processedChats / totalChats) * 100) : 0;

  return (
    <div className={`card border-2 border-blue-200 ${className}`}>
      {/* Header */}
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Loader2 className={`text-blue-600 ${activeJobs.length > 0 ? 'animate-spin' : ''}`} size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">
              Batch Processing {activeJobs.length > 0 && `(${activeJobs.length} ativo${activeJobs.length > 1 ? 's' : ''})`}
            </h3>
            <p className="text-sm text-gray-600">
              {processedChats} de {totalChats} chats processados ({overallProgress}%)
            </p>
          </div>
        </div>
        <button className="p-1 hover:bg-gray-100 rounded">
          <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </button>
      </div>

      {/* Overall Progress Bar */}
      <div className="mt-3 w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
        <div 
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${overallProgress}%` }}
        />
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-4 space-y-3">
          {/* Active Jobs */}
          {activeJobs.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Em andamento</h4>
              <div className="space-y-2">
                {activeJobs.map((job) => (
                  <div key={job.id} className="p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(job.status)}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(job.status)}`}>
                          {getStatusText(job.status)}
                        </span>
                        <span className="text-sm text-gray-600">
                          {job.processedChats}/{job.totalChats} chats
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {job.startedAt && (
                          <span className="text-xs text-gray-500">
                            {formatDuration(job.startedAt)}
                          </span>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancel(job.id);
                          }}
                          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Cancelar"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="w-full bg-blue-200 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                    {job.failedChats > 0 && (
                      <p className="mt-1 text-xs text-red-600">
                        {job.failedChats} falha{job.failedChats > 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed Jobs */}
          {completedJobs.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700">Histórico</h4>
                <button
                  onClick={handleClearCompleted}
                  className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  <Trash2 size={12} />
                  Limpar
                </button>
              </div>
              <div className="space-y-1">
                {completedJobs.slice(0, 5).map((job) => (
                  <div 
                    key={job.id} 
                    className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                  >
                    <div className="flex items-center gap-2">
                      {getStatusIcon(job.status)}
                      <span className="text-gray-700">
                        {job.processedChats}/{job.totalChats} chats
                      </span>
                      {job.failedChats > 0 && (
                        <span className="text-xs text-red-500">
                          ({job.failedChats} falha{job.failedChats > 1 ? 's' : ''})
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {job.completedAt && formatTime(job.completedAt)}
                    </span>
                  </div>
                ))}
                {completedJobs.length > 5 && (
                  <p className="text-xs text-gray-500 text-center py-1">
                    +{completedJobs.length - 5} mais
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
