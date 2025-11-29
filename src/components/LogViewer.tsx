import { useState, useEffect } from 'react';
import { AlertCircle, Info, AlertTriangle, Bug, Trash2, Download, RefreshCw } from 'lucide-react';
import { getLogs, clearLogs, exportLogs, onLogUpdate, type LogEntry, type LogLevel } from '../services/logger';

function getLogIcon(level: LogLevel) {
  switch (level) {
    case 'debug':
      return <Bug className="text-gray-400" size={14} />;
    case 'info':
      return <Info className="text-blue-500" size={14} />;
    case 'warn':
      return <AlertTriangle className="text-yellow-500" size={14} />;
    case 'error':
      return <AlertCircle className="text-red-500" size={14} />;
  }
}

function getLogColor(level: LogLevel): string {
  switch (level) {
    case 'debug':
      return 'bg-gray-50 border-gray-200';
    case 'info':
      return 'bg-blue-50 border-blue-200';
    case 'warn':
      return 'bg-yellow-50 border-yellow-200';
    case 'error':
      return 'bg-red-50 border-red-200';
  }
}

function formatTimestamp(timestamp: string): string {
  return new Date(timestamp).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

interface LogViewerProps {
  maxHeight?: string;
}

export default function LogViewer({ maxHeight = '400px' }: LogViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>(getLogs());
  const [filter, setFilter] = useState<LogLevel | 'all'>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const unsubscribe = onLogUpdate((updatedLogs) => {
      setLogs(updatedLogs);
    });
    return unsubscribe;
  }, []);

  const services = [...new Set(logs.map(log => log.service))];
  
  const filteredLogs = logs
    .filter(log => filter === 'all' || log.level === filter)
    .filter(log => serviceFilter === 'all' || log.service === serviceFilter)
    .slice(-100) // Show last 100 logs
    .reverse(); // Most recent first

  const handleClear = () => {
    if (confirm('Tem certeza que deseja limpar todos os logs?')) {
      clearLogs();
    }
  };

  const handleExport = () => {
    const data = exportLogs();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chatinsight-logs-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRefresh = () => {
    setLogs(getLogs());
  };

  const errorCount = logs.filter(l => l.level === 'error').length;
  const warnCount = logs.filter(l => l.level === 'warn').length;

  return (
    <div className="card">
      {/* Header */}
      <div 
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-900">System Logs</h3>
          <div className="flex items-center gap-2 text-sm">
            {errorCount > 0 && (
              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full">
                {errorCount} errors
              </span>
            )}
            {warnCount > 0 && (
              <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full">
                {warnCount} warnings
              </span>
            )}
            <span className="text-gray-500">{logs.length} total</span>
          </div>
        </div>
        <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="mt-4">
          {/* Filters and Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as LogLevel | 'all')}
                className="text-sm px-2 py-1 border border-gray-300 rounded"
              >
                <option value="all">Todos os níveis</option>
                <option value="error">Errors</option>
                <option value="warn">Warnings</option>
                <option value="info">Info</option>
                <option value="debug">Debug</option>
              </select>
              
              <select
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                className="text-sm px-2 py-1 border border-gray-300 rounded"
              >
                <option value="all">Todos os serviços</option>
                {services.map(service => (
                  <option key={service} value={service}>{service}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={handleRefresh}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                title="Atualizar"
              >
                <RefreshCw size={16} />
              </button>
              <button
                onClick={handleExport}
                className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                title="Exportar logs"
              >
                <Download size={16} />
              </button>
              <button
                onClick={handleClear}
                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                title="Limpar logs"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {/* Log List */}
          <div 
            className="space-y-1 overflow-y-auto"
            style={{ maxHeight }}
          >
            {filteredLogs.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Nenhum log encontrado</p>
            ) : (
              filteredLogs.map((log, index) => (
                <div 
                  key={`${log.timestamp}-${index}`}
                  className={`p-2 rounded border text-sm ${getLogColor(log.level)}`}
                >
                  <div className="flex items-start gap-2">
                    {getLogIcon(log.level)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-gray-500">
                          {formatTimestamp(log.timestamp)}
                        </span>
                        <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-700 rounded">
                          {log.service}
                        </span>
                      </div>
                      <p className="text-gray-900 mt-0.5">{log.message}</p>
                      {log.data && Object.keys(log.data).length > 0 && (
                        <pre className="mt-1 text-xs text-gray-600 bg-white bg-opacity-50 p-1 rounded overflow-x-auto">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      )}
                      {log.error && (
                        <p className="mt-1 text-xs text-red-600">
                          Error: {log.error}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
