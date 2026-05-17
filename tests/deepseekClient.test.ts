import { describe, expect, it } from "vitest";
import { createDeepSeekClient } from "../src/ai/deepseekClient.js";

describe("createDeepSeekClient", () => {
  it("calls the DeepSeek chat completions API and returns message content", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetcher: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({
        choices: [{ message: { content: "生成的综述报告" } }]
      }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    };
    const client = createDeepSeekClient({
      apiKey: "test-key",
      baseUrl: "https://api.deepseek.example",
      model: "deepseek-test",
      fetcher
    });

    const result = await client.createChatCompletion([
      { role: "user", content: "请生成综述" }
    ]);

    expect(result).toBe("生成的综述报告");
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.deepseek.example/chat/completions");
    expect(calls[0].init.method).toBe("POST");
    expect(calls[0].init.headers).toMatchObject({
      authorization: "Bearer test-key",
      "content-type": "application/json"
    });
    expect(JSON.parse(String(calls[0].init.body))).toMatchObject({
      model: "deepseek-test",
      messages: [{ role: "user", content: "请生成综述" }]
    });
  });

  it("throws a stable error when the API key is missing", async () => {
    const client = createDeepSeekClient({
      apiKey: "",
      baseUrl: "https://api.deepseek.example",
      model: "deepseek-test"
    });

    await expect(client.createChatCompletion([
      { role: "user", content: "请生成综述" }
    ])).rejects.toThrow("DEEPSEEK_API_KEY_MISSING");
  });
});
