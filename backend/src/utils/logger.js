/**
 * Structured Telemetry Logger
 * Logs errors, warnings, and performance metrics with timestamps, error codes, and contextual tags.
 */
export const logger = {
  info: (tag, message, meta = {}) => {
    console.log(`[${new Date().toISOString()}] [INFO] [${tag}] ${message}`, Object.keys(meta).length ? JSON.stringify(meta) : '');
  },

  warn: (tag, message, meta = {}) => {
    console.warn(`[${new Date().toISOString()}] [WARN] [${tag}] ${message}`, Object.keys(meta).length ? JSON.stringify(meta) : '');
  },

  error: (tag, message, err = null, meta = {}) => {
    const errorDetails = {
      timestamp: new Date().toISOString(),
      tag,
      message,
      errorMessage: err?.message || String(err),
      errorCode: err?.code || err?.name || 'ERR_INTERNAL',
      stack: err?.stack ? err.stack.split('\n').slice(0, 4).join(' | ') : undefined,
      ...meta,
    };
    console.error(`[${errorDetails.timestamp}] [ERROR] [${tag}] ${message} -> ${errorDetails.errorMessage} (Code: ${errorDetails.errorCode})`, errorDetails.stack ? `| ${errorDetails.stack}` : '');
  },

  debug: (tag, message, meta = {}) => {
    if (process.env.DEBUG === 'true') {
      console.debug(`[${new Date().toISOString()}] [DEBUG] [${tag}] ${message}`, Object.keys(meta).length ? JSON.stringify(meta) : '');
    }
  },
};

export default logger;
