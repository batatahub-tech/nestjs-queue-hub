import { QueueHubLogLevel } from '../interfaces/shared-queue-hub-config.interface';

let globalLogLevel: QueueHubLogLevel = QueueHubLogLevel.INFO;

/**
 * Set the global log level for queue-hub
 */
export function setLogLevel(level: QueueHubLogLevel): void {
  globalLogLevel = level;
}

/**
 * Get the current global log level
 */
export function getLogLevel(): QueueHubLogLevel {
  return globalLogLevel;
}

/**
 * Simple logger for queue-hub
 */
export class QueueHubLogger {
  constructor(
    private readonly context: string,
    private readonly logLevel: QueueHubLogLevel = globalLogLevel,
  ) {}

  error(message: string, ...args: any[]): void {
    if (this.logLevel >= QueueHubLogLevel.ERROR) {
      console.error(`[${this.context}]`, message, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.logLevel >= QueueHubLogLevel.WARN) {
      console.warn(`[${this.context}]`, message, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.logLevel >= QueueHubLogLevel.INFO) {
      console.log(`[${this.context}]`, message, ...args);
    }
  }

  debug(message: string, ...args: any[]): void {
    if (this.logLevel >= QueueHubLogLevel.DEBUG) {
      console.log(`[${this.context}] [DEBUG]`, message, ...args);
    }
  }
}
