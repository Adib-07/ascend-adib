type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: { name: string; message: string; stack?: string };
}

function formatLogEntry(entry: LogEntry): string {
  return JSON.stringify(entry);
}

function shouldLog(level: LogLevel): boolean {
  const levels: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
  const minLevel = process.env.LOG_LEVEL ?? "info";
  return levels[level] >= levels[minLevel as LogLevel];
}

export function logDebug(message: string, context?: Record<string, unknown>) {
  if (shouldLog("debug")) {
    console.log(
      formatLogEntry({ timestamp: new Date().toISOString(), level: "debug", message, context }),
    );
  }
}

export function logInfo(message: string, context?: Record<string, unknown>) {
  if (shouldLog("info")) {
    console.log(
      formatLogEntry({ timestamp: new Date().toISOString(), level: "info", message, context }),
    );
  }
}

export function logWarn(message: string, context?: Record<string, unknown>, error?: Error) {
  if (shouldLog("warn")) {
    console.warn(
      formatLogEntry({
        timestamp: new Date().toISOString(),
        level: "warn",
        message,
        context,
        error: error ? { name: error.name, message: error.message, stack: error.stack } : undefined,
      }),
    );
  }
}

export function logError(message: string, context?: Record<string, unknown>, error?: Error) {
  if (shouldLog("error")) {
    console.error(
      formatLogEntry({
        timestamp: new Date().toISOString(),
        level: "error",
        message,
        context,
        error: error ? { name: error.name, message: error.message, stack: error.stack } : undefined,
      }),
    );
  }
}

export function logAIError(operation: string, error: Error, context?: Record<string, unknown>) {
  logError(`AI operation failed: ${operation}`, { ...context, operation }, error);
}

export function logAutomationError(
  ruleId: string,
  error: Error,
  context?: Record<string, unknown>,
) {
  logError(`Automation failed: ${ruleId}`, { ...context, ruleId }, error);
}

export function logDocumentError(
  documentId: string,
  error: Error,
  context?: Record<string, unknown>,
) {
  logError(`Document processing failed: ${documentId}`, { ...context, documentId }, error);
}

export function logDatasetError(
  datasetId: string,
  error: Error,
  context?: Record<string, unknown>,
) {
  logError(`Dataset ingestion failed: ${datasetId}`, { ...context, datasetId }, error);
}

export function logSchedulerError(task: string, error: Error, context?: Record<string, unknown>) {
  logError(`Scheduler task failed: ${task}`, { ...context, task }, error);
}

export function logDBError(operation: string, error: Error, context?: Record<string, unknown>) {
  logError(`Database operation failed: ${operation}`, { ...context, operation }, error);
}
