import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadEnvFile } from "../src/config/envFile.js";

const originalEnv = { ...process.env };
let tempDir: string | null = null;

afterEach(() => {
  process.env = { ...originalEnv };
  if (tempDir) {
    rmSync(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

describe("loadEnvFile", () => {
  it("loads key value pairs from a dotenv file without overriding existing values", () => {
    tempDir = mkdtempSync(join(tmpdir(), "cnki-env-"));
    const envPath = join(tempDir, ".env");
    process.env.JWT_SECRET = "already-set";
    writeFileSync(envPath, [
      "DEEPSEEK_API_KEY=\"test-key\"",
      "JWT_SECRET=\"from-file\"",
      "EMPTY_VALUE=",
      "# comment"
    ].join("\n"));

    loadEnvFile(envPath);

    expect(process.env.DEEPSEEK_API_KEY).toBe("test-key");
    expect(process.env.JWT_SECRET).toBe("already-set");
    expect(process.env.EMPTY_VALUE).toBe("");
  });
});
