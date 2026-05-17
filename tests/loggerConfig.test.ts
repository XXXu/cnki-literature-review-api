import { describe, expect, it } from "vitest";
import { loadLoggerConfig } from "../src/config/logger.js";

describe("logger config", () => {
  it("默认写入 logs/app.log", () => {
    expect(loadLoggerConfig({})).toEqual({
      level: "info",
      file: "logs/app.log"
    });
  });

  it("支持通过环境变量覆盖日志级别和文件路径", () => {
    expect(loadLoggerConfig({
      LOG_LEVEL: "debug",
      LOG_FILE: "/var/log/cnki-api/app.log"
    })).toEqual({
      level: "debug",
      file: "/var/log/cnki-api/app.log"
    });
  });
});
