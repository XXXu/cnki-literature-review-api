export type LoggerConfig = {
  level: string;
  file: string;
};

export function loadLoggerConfig(env: NodeJS.ProcessEnv = process.env): LoggerConfig {
  return {
    level: env.LOG_LEVEL?.trim() || "info",
    file: env.LOG_FILE?.trim() || "logs/app.log"
  };
}
