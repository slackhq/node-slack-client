import { Logger, LogLevel, ConsoleLogger } from '@slack/logger';

export { Logger, LogLevel };

let instanceCount = 0;

/**
 * INTERNAL interface for getting or creating a named Logger.
 * @param name logger name
 * @param level level to set in the logger
 * @param existingLogger existing logger to configure
 */
export function getLogger(name: string, level: LogLevel, existingLogger?: Logger): Logger {
  // Get a unique ID for the logger.
  const instanceId = instanceCount;
  instanceCount += 1;

  // Set up the logger.
  const logger: Logger = (() => {
    if (existingLogger !== undefined) { return existingLogger; }
    return new ConsoleLogger();
  })();
  logger.setName(`${name}:${instanceId}`);
  if (level !== undefined) {
    logger.setLevel(level);
  }

  return logger;
}
