/**
 * Canvas logging utility - Only logs when DEBUG_FLAGS.CANVAS is true
 */

import { DEBUG_FLAGS } from './constants';

export const canvasLog = {
  log: (...args: any[]) => {
    if (DEBUG_FLAGS.CANVAS) {
      console.log(...args);
    }
  },
  warn: (...args: any[]) => {
    if (DEBUG_FLAGS.CANVAS) {
      console.warn(...args);
    }
  },
  error: (...args: any[]) => {
    // Always log errors
    console.error(...args);
  },
};
