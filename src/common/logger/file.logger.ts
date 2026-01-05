import { ConsoleLogger, ConsoleLoggerOptions, LogLevel } from '@nestjs/common';
import { inspect } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const MAX_LOG_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB
const DEFAULT_TRIMMED_LOG_CHUNK_BYTES = 80 * 1024 * 1024; // keep at most 80 MB when trimming
const DEFAULT_LOG_PATH = path.join(process.cwd(), 'logs', 'zigscan-api.log');

export class FileLogger extends ConsoleLogger {
  private readonly logfilePath: string;

  constructor(context?: string, options?: ConsoleLoggerOptions & { logfilePath?: string }) {
    const { logfilePath, ...consoleOptions } = options ?? {};
    super(context, consoleOptions as ConsoleLoggerOptions);
    this.logfilePath = logfilePath ?? DEFAULT_LOG_PATH;
  }

  log(message: unknown, context?: string) {
    super.log(message, context);
    this.persistLog('LOG', message, context);
  }

  error(message: unknown, stackOrContext?: string, context?: string) {
    super.error(message, stackOrContext, context);
    const { stack, resolvedContext } = this.resolveStackAndContext(stackOrContext, context);
    this.persistLog('ERROR', message, resolvedContext, stack);
  }

  warn(message: unknown, context?: string) {
    super.warn(message, context);
    this.persistLog('WARN', message, context);
  }

  debug(message: unknown, context?: string) {
    super.debug(message, context);
    this.persistLog('DEBUG', message, context);
  }

  verbose(message: unknown, context?: string) {
    super.verbose(message, context);
    this.persistLog('VERBOSE', message, context);
  }

  setLogLevels(levels: LogLevel[]) {
    super.setLogLevels(levels);
  }

  private resolveStackAndContext(
    stackOrContext?: unknown,
    context?: string,
  ): { stack?: string; resolvedContext?: string } {
    if (!stackOrContext) {
      return { stack: undefined, resolvedContext: context };
    }

    // Handle Error objects or any object with a stack string.
    if (stackOrContext instanceof Error) {
      return { stack: stackOrContext.stack ?? stackOrContext.message, resolvedContext: context };
    }

    // If the second parameter looks like a stack trace (contains newline), treat it as stack.
    if (typeof stackOrContext === 'string' && stackOrContext.includes('\n')) {
      return { stack: stackOrContext, resolvedContext: context };
    }

    // Fallback: treat it as the context if it was not a stack trace.
    return { stack: undefined, resolvedContext: String(stackOrContext) };
  }

  private persistLog(level: string, message: unknown, context?: string, stack?: string) {
    try {
      const timestamp = new Date().toISOString();
      const formattedMessage = this.formatForFile(message);
      const header = `[${timestamp}] [${level}]${context ? ` [${context}]` : ''} ${formattedMessage}`;
      const entry = stack ? `${header}\n${stack}\n` : `${header}\n`;

      this.ensureDirectory();
      this.trimFileIfNeeded(Buffer.byteLength(entry));

      fs.appendFileSync(this.logfilePath, entry, { encoding: 'utf8' });
    } catch (error) {
      super.error(
        `Failed to write log to ${this.logfilePath}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private ensureDirectory() {
    const dir = path.dirname(this.logfilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private trimFileIfNeeded(incomingEntryBytes: number) {
    if (!fs.existsSync(this.logfilePath)) {
      return;
    }

    const stats = fs.statSync(this.logfilePath);
    if (stats.size + incomingEntryBytes <= MAX_LOG_FILE_SIZE_BYTES) {
      return;
    }

    const availableForExisting = Math.max(MAX_LOG_FILE_SIZE_BYTES - incomingEntryBytes, 0);
    const bytesToKeep = Math.min(DEFAULT_TRIMMED_LOG_CHUNK_BYTES, availableForExisting);

    if (bytesToKeep === 0) {
      fs.truncateSync(this.logfilePath, 0);
      return;
    }

    const startPosition = Math.max(stats.size - bytesToKeep, 0);
    const tempBuffer = Buffer.alloc(bytesToKeep);

    const fd = fs.openSync(this.logfilePath, 'r+');
    try {
      const bytesRead = fs.readSync(fd, tempBuffer, 0, bytesToKeep, startPosition);
      fs.ftruncateSync(fd, 0);
      if (bytesRead > 0) {
        fs.writeSync(fd, tempBuffer, 0, bytesRead, 0);
      }
    } finally {
      fs.closeSync(fd);
    }
  }

  private formatForFile(message: unknown): string {
    if (typeof message === 'string') {
      return message;
    }
    if (message instanceof Error) {
      return message.stack ?? message.message;
    }
    return inspect(message, { depth: 5, breakLength: 120 });
  }
}
