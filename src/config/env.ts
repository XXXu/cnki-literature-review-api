export type AppConfig = {
  deepSeekApiKey: string;
  deepSeekBaseUrl: string;
  deepSeekModel: string;
  jwtSecret: string;
};

export function loadConfig(): AppConfig {
  return {
    deepSeekApiKey: process.env.DEEPSEEK_API_KEY ?? "",
    deepSeekBaseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
    deepSeekModel: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
    jwtSecret: process.env.JWT_SECRET ?? "development-secret"
  };
}
