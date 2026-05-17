import { describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "../src/ai/deepseekClient.js";
import { createReviewGenerator } from "../src/review/reviewGenerator.js";

describe("review generator", () => {
  it("快速综述提示词限定为摘要级分析", async () => {
    const createChatCompletion = vi.fn().mockResolvedValue("快速综述报告");
    const generator = createReviewGenerator({ createChatCompletion });

    await generator.generateQuickReview([{
      id: "P0001",
      title: "测试论文",
      abstract: "这是一段摘要。",
      keywords: ["文献综述"]
    }]);

    const messages = createChatCompletion.mock.calls[0][0] as ChatMessage[];
    const prompt = messages.map((message: ChatMessage) => message.content).join("\n");
    expect(prompt).toContain("题录、摘要和关键词");
    expect(prompt).toContain("不包含论文全文");
    expect(prompt).toContain("不要推断论文的研究方法、论证过程、数据来源或材料细节");
    expect(prompt).toContain("建议优先核对或精读的论文");
    expect(prompt).not.toContain("建议下载全文精读");
  });
});
