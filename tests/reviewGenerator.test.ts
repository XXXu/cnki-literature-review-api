import { describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "../src/ai/deepseekClient.js";
import { createReviewGenerator } from "../src/review/reviewGenerator.js";

describe("review generator", () => {
  const bilingualInstruction = "如果材料为英文或中英混合，请先理解原文含义，再用中文输出综述";

  function collectPrompt(messages: ChatMessage[]) {
    return messages.map((message: ChatMessage) => message.content).join("\n");
  }

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
    const prompt = collectPrompt(messages);
    expect(prompt).toContain("题录、摘要和关键词");
    expect(prompt).toContain("不包含论文全文");
    expect(prompt).toContain("不要推断论文的研究方法、论证过程、数据来源或材料细节");
    expect(prompt).toContain("已有研究贡献");
    expect(prompt).toContain("已有研究贡献只能根据题录和摘要归纳");
    expect(prompt).toContain("建议优先核对或精读的论文");
    expect(prompt).toContain(bilingualInstruction);
    expect(prompt).toContain("专业术语、理论名称、模型名称和变量名称应保留英文原文");
    expect(prompt).not.toContain("建议下载全文精读");
  });

  it("深度综述提示词支持英文和中英混合材料", async () => {
    const createChatCompletion = vi.fn().mockResolvedValue("深度综述报告");
    const generator = createReviewGenerator({ createChatCompletion });

    await generator.generateDeepReview([{
      id: "P0001",
      title: "A Study on Literature Review",
      abstract: "This paper discusses literature review methods.",
      keywords: ["literature review"],
      fullText: "The full text discusses methodology and findings."
    }]);

    const messages = createChatCompletion.mock.calls[0][0] as ChatMessage[];
    const prompt = collectPrompt(messages);
    expect(prompt).toContain("PDF 全文");
    expect(prompt).toContain("已有研究贡献");
    expect(prompt).toContain("已有研究贡献应基于 PDF 全文和摘要中的证据归纳");
    expect(prompt).toContain(bilingualInstruction);
    expect(prompt).toContain("专业术语、理论名称、模型名称和变量名称应保留英文原文");
  });
});
