/**
 * Centralized Logger
 *
 * Provides consistent logging across the application with configurable levels and categories.
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.canvas.log('Canvas initialized');
 *   logger.game.error('Game error', error);
 *   logger.solana.debug('Transaction sent', signature);
 */

export enum LogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
}

export enum LogCategory {
  CANVAS = "canvas",
  GAME = "game",
  SOLANA = "solana",
  WALLET = "wallet",
  SSE = "sse",
  SOUND = "sound",
  ACCOUNT_PARSER = "accountParser",
  ALL = "all",
}

interface LogConfig {
  [key: string]: LogLevel;
}

// Configuration - Set log levels for each category
// You can also set via localStorage: localStorage.setItem('logConfig', JSON.stringify({canvas: 0, game: 4}))
const DEFAULT_CONFIG: LogConfig = {
  [LogCategory.CANVAS]: LogLevel.NONE, // Hide canvas logs by default
  [LogCategory.GAME]: LogLevel.INFO, // Show game info
  [LogCategory.SOLANA]: LogLevel.DEBUG, // Show all Solana logs
  [LogCategory.WALLET]: LogLevel.INFO, // Show wallet info
  [LogCategory.SSE]: LogLevel.INFO, // Show SSE info
  [LogCategory.SOUND]: LogLevel.NONE, // Hide sound logs by default
  [LogCategory.ACCOUNT_PARSER]: LogLevel.DEBUG, // Show parser logs for debugging
  [LogCategory.ALL]: LogLevel.INFO, // Default for uncategorized logs
};

class Logger {
  private config: LogConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): LogConfig {
    if (typeof window === "undefined") {
      return DEFAULT_CONFIG;
    }

    try {
      const stored = localStorage.getItem("logConfig");
      if (stored) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
      }
    } catch (e) {
      // Ignore localStorage errors
    }

    return DEFAULT_CONFIG;
  }

  private shouldLog(category: LogCategory, level: LogLevel): boolean {
    const categoryLevel =
      this.config[category] ?? this.config[LogCategory.ALL] ?? LogLevel.INFO;
    return level <= categoryLevel;
  }

  private formatMessage(category: string, message: string): string {
    const emoji = this.getCategoryEmoji(category);
    return `[${category.toUpperCase()}] ${emoji} ${message}`;
  }

  private getCategoryEmoji(category: string): string {
    const emojis: Record<string, string> = {
      canvas: "🎨",
      game: "🎮",
      solana: "Link:",
      wallet: "Amount:",
      sse: "📡",
      sound: "🎵",
      accountParser: "Package:",
    };
    return emojis[category] || "📋";
  }

  private createCategoryLogger(category: LogCategory) {
    return {
      error: (message: string, ...args: any[]) => {
        if (this.shouldLog(category, LogLevel.ERROR)) {
          console.error(this.formatMessage(category, message), ...args);
        }
      },
      warn: (message: string, ...args: any[]) => {
        if (this.shouldLog(category, LogLevel.WARN)) {
          console.warn(this.formatMessage(category, message), ...args);
        }
      },
      info: (message: string, ...args: any[]) => {
        if (this.shouldLog(category, LogLevel.INFO)) {
          console.log(this.formatMessage(category, message), ...args);
        }
      },
      log: (message: string, ...args: any[]) => {
        if (this.shouldLog(category, LogLevel.INFO)) {
          console.log(this.formatMessage(category, message), ...args);
        }
      },
      debug: (message: string, ...args: any[]) => {
        if (this.shouldLog(category, LogLevel.DEBUG)) {
          console.log(this.formatMessage(category, message), ...args);
        }
      },
    };
  }

  // Category-specific loggers
  public canvas = this.createCategoryLogger(LogCategory.CANVAS);
  public game = this.createCategoryLogger(LogCategory.GAME);
  public solana = this.createCategoryLogger(LogCategory.SOLANA);
  public wallet = this.createCategoryLogger(LogCategory.WALLET);
  public sse = this.createCategoryLogger(LogCategory.SSE);
  public sound = this.createCategoryLogger(LogCategory.SOUND);
  public accountParser = this.createCategoryLogger(LogCategory.ACCOUNT_PARSER);

  // Update config at runtime
  public setLogLevel(category: LogCategory | string, level: LogLevel) {
    this.config[category] = level;
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("logConfig", JSON.stringify(this.config));
      } catch (e) {
        // Ignore localStorage errors
      }
    }
  }

  // Enable all logs (for debugging)
  public enableAll() {
    Object.keys(this.config).forEach((key) => {
      this.config[key] = LogLevel.DEBUG;
    });
  }

  // Disable all logs
  public disableAll() {
    Object.keys(this.config).forEach((key) => {
      this.config[key] = LogLevel.NONE;
    });
  }

  // Show current configuration
  public showConfig() {
    console.table(this.config);
  }
}

// Singleton instance
export const logger = new Logger();

// Make logger available globally for debugging in console
if (typeof window !== "undefined") {
  (window as any).logger = logger;
}
