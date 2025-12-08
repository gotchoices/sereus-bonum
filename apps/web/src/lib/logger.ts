// Logging module with configurable levels
// Enable via: VITE_LOG_LEVEL=debug (or info, warn, error, none)

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 99,
};

// Get log level from environment or default to 'info' in dev, 'warn' in prod
function getLogLevel(): LogLevel {
  const envLevel = import.meta.env.VITE_LOG_LEVEL as LogLevel | undefined;
  if (envLevel && LEVEL_PRIORITY[envLevel] !== undefined) {
    return envLevel;
  }
  return import.meta.env.DEV ? 'debug' : 'warn';
}

const currentLevel = getLogLevel();

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel];
}

function formatArgs(tag: string, args: unknown[]): unknown[] {
  const timestamp = new Date().toISOString().slice(11, 23);
  return [`[${timestamp}] [${tag}]`, ...args];
}

/**
 * Create a logger for a specific module/component
 */
export function createLogger(tag: string) {
  return {
    debug(...args: unknown[]) {
      if (shouldLog('debug')) {
        console.debug(...formatArgs(tag, args));
      }
    },
    
    info(...args: unknown[]) {
      if (shouldLog('info')) {
        console.info(...formatArgs(tag, args));
      }
    },
    
    warn(...args: unknown[]) {
      if (shouldLog('warn')) {
        console.warn(...formatArgs(tag, args));
      }
    },
    
    error(...args: unknown[]) {
      if (shouldLog('error')) {
        console.error(...formatArgs(tag, args));
      }
    },
    
    /** Log with explicit level */
    log(level: LogLevel, ...args: unknown[]) {
      if (shouldLog(level)) {
        const method = level === 'debug' ? 'debug' : level === 'info' ? 'info' : level === 'warn' ? 'warn' : 'error';
        console[method](...formatArgs(tag, args));
      }
    },
    
    /** Time an async operation */
    async time<T>(label: string, fn: () => Promise<T>): Promise<T> {
      if (!shouldLog('debug')) return fn();
      
      const start = performance.now();
      this.debug(`${label} started`);
      try {
        const result = await fn();
        const elapsed = (performance.now() - start).toFixed(1);
        this.debug(`${label} completed in ${elapsed}ms`);
        return result;
      } catch (e) {
        const elapsed = (performance.now() - start).toFixed(1);
        this.error(`${label} failed after ${elapsed}ms`, e);
        throw e;
      }
    }
  };
}

// Pre-configured loggers for core modules
export const log = {
  app: createLogger('App'),
  data: createLogger('Data'),
  sqlite: createLogger('SQLite'),
  entities: createLogger('Entities'),
  vbs: createLogger('VBS'),
};

