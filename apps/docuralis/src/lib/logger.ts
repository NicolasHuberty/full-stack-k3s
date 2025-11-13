import winston from 'winston'

const logLevel = process.env.LOG_LEVEL || 'info'

// Create Winston logger
export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'docuralis' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
})

// Add file transports in production
if (process.env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    })
  )

  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    })
  )
}

// Helper functions for structured logging
export const logInfo = (message: string, meta?: Record<string, unknown>) => {
  logger.info(message, meta)
}

export const logError = (
  message: string,
  error?: Error | unknown,
  meta?: Record<string, unknown>
) => {
  logger.error(message, {
    ...meta,
    error:
      error instanceof Error
        ? {
            message: error.message,
            stack: error.stack,
            name: error.name,
          }
        : error,
  })
}

export const logWarn = (message: string, meta?: Record<string, unknown>) => {
  logger.warn(message, meta)
}

export const logDebug = (message: string, meta?: Record<string, unknown>) => {
  logger.debug(message, meta)
}
