import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("start.sh", () => {
  it("提供服务器启动脚本", () => {
    const script = readFileSync("bin/start.sh", "utf8");

    expect(script).toContain("#!/usr/bin/env bash");
    expect(script).toContain("set -euo pipefail");
    expect(script).toContain("cd \"$ROOT_DIR\"");
    expect(script).toContain("mkdir -p \"${LOG_FILE_DIR}\"");
    expect(script).toContain("dist/src/server.js");
    expect(script).toContain("exec node dist/src/server.js");
  });
});
