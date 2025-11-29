/**
 * Structured logging service for ChatInsight
 * Logs are stored in localStorage and displayed in console
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  data?: Record<string, unknown>;
  error?: string;
  stack?: string;
}

const LOG_STORAGE_KEY = 'chatinsight-logs';
const MAX_LOGS = 500; // Keep last 500 logs

let logs: LogEntry[] = [];
let logCallbacks: ((logs: LogEntry[]) => void)[] = [];

/**
 * Initialize logger - load from localStorage
 */
export function initLogger(): void {
  try {
    const stored = localStorage.getItem(LOG_STORAGE_KEY);
    if (stored) {
      logs = JSON.parse(stored);
    }
  } catch (e) {
    logs = [];
  }
}

/**
 * Save logs to localStorage
 */
function saveLogs(): void {
  try {
    // Keep only last MAX_LOGS entries
    if (logs.length > MAX_LOGS) {
      logs = logs.slice(-MAX_LOGS);
    }
    localStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(logs));
  } catch (e) {
    console.error('Failed to save logs:', e);
  }
}

/**
 * Subscribe to log updates
 */
export function onLogUpdate(callback: (logs: LogEntry[]) => void): () => void {
  logCallbacks.push(callback);
  return () => {
    logCallbacks = logCallbacks.filter(cb => cb !== callback);
  };
}

/**
 * Notify all subscribers
 */
function notifyLogUpdate(): void {
  logCallbacks.forEach(cb => cb([...logs]));
}

/**
 * Create a log entry
 */
function createLogEntry(
  level: LogLevel,
  service: string,
  message: string,
  data?: Record<string, unknown>,
  error?: Error
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    service,
    message,
    data,
    error: error?.message,
    stack: error?.stack,
  };
}

/**
 * Add a log entry
 */
function addLog(entry: LogEntry): void {
  logs.push(entry);
  saveLogs();
  notifyLogUpdate();

  // Also log to console with appropriate styling
  const timestamp = new Date(entry.timestamp).toLocaleTimeString('pt-BR');
  const prefix = `[${timestamp}] [${entry.service}]`;

  switch (entry.level) {
    case 'debug':
      console.debug(`%c${prefix} ${entry.message}`, 'color: gray', entry.data || '');
      break;
    case 'info':
      console.info(`%c${prefix} ${entry.message}`, 'color: blue', entry.data || '');
      break;
    case 'warn':
      console.warn(`${prefix} ${entry.message}`, entry.data || '');
      break;
    case 'error':
      console.error(`${prefix} ${entry.message}`, entry.data || '', entry.error || '');
      break;
  }
}

/**
 * Create a logger instance for a specific service
 */
export function createLogger(service: string) {
  return {
    debug: (message: string, data?: Record<string, unknown>) => {
      addLog(createLogEntry('debug', service, message, data));
    },
    info: (message: string, data?: Record<string, unknown>) => {
      addLog(createLogEntry('info', service, message, data));
    },
    warn: (message: string, data?: Record<string, unknown>) => {
      addLog(createLogEntry('warn', service, message, data));
    },
    error: (message: string, error?: Error, data?: Record<string, unknown>) => {
      addLog(createLogEntry('error', service, message, data, error));
    },
  };
}

/**
 * Get all logs
 */
export function getLogs(): LogEntry[] {
  return [...logs];
}

/**
 * Get logs filtered by level
 */
export function getLogsByLevel(level: LogLevel): LogEntry[] {
  return logs.filter(log => log.level === level);
}

/**
 * Get logs filtered by service
 */
export function getLogsByService(service: string): LogEntry[] {
  return logs.filter(log => log.service === service);
}

/**
 * Get recent logs (last N entries)
 */
export function getRecentLogs(count: number = 50): LogEntry[] {
  return logs.slice(-count);
}

/**
 * Clear all logs
 */
export function clearLogs(): void {
  logs = [];
  saveLogs();
  notifyLogUpdate();
}

/**
 * Export logs as JSON string
 */
export function exportLogs(): string {
  return JSON.stringify(logs, null, 2);
}

// Initialize on module load
initLogger();
