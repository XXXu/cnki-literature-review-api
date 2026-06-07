export type AppConfig = {
  deepSeekApiKey: string;
  deepSeekBaseUrl: string;
  deepSeekModel: string;
  jwtSecret: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  smtpFromName: string;
};

export function loadConfig(): AppConfig {
  return {
    deepSeekApiKey: process.env.DEEPSEEK_API_KEY ?? "",
    deepSeekBaseUrl: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
    deepSeekModel: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
    jwtSecret: process.env.JWT_SECRET ?? "development-secret",
    smtpHost: process.env.SMTP_HOST ?? "",
    smtpPort: Number(process.env.SMTP_PORT ?? 465),
    smtpSecure: (process.env.SMTP_SECURE ?? "true").toLowerCase() !== "false",
    smtpUser: process.env.SMTP_USER ?? "",
    smtpPass: process.env.SMTP_PASS ?? "",
    smtpFrom: process.env.SMTP_FROM ?? "",
    smtpFromName: process.env.SMTP_FROM_NAME ?? "知网文献综述助手"
  };
}
