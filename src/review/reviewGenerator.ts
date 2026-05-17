import type { ChatMessage } from "../ai/deepseekClient.js";

export type ReviewPaper = {
  id: string;
  title: string;
  abstract: string;
  keywords: string[];
  fullText?: string;
};

export type ReviewGenerator = {
  generateQuickReview(papers: ReviewPaper[]): Promise<string>;
  generateDeepReview(papers: ReviewPaper[]): Promise<string>;
};

type DeepSeekLikeClient = {
  createChatCompletion(messages: ChatMessage[]): Promise<string>;
};

function paperBrief(paper: ReviewPaper) {
  return [
    `[论文ID] ${paper.id}`,
    `题名：${paper.title}`,
    `关键词：${paper.keywords.join("；")}`,
    `摘要：${paper.abstract}`
  ].join("\n");
}

function paperFullTextBlock(paper: ReviewPaper) {
  return [
    paperBrief(paper),
    `全文：${paper.fullText ?? ""}`
  ].join("\n");
}

export function createReviewGenerator(client: DeepSeekLikeClient): ReviewGenerator {
  return {
    async generateQuickReview(papers) {
      return client.createChatCompletion([
        {
          role: "system",
          content: "你是严谨的中文学术文献综述助手。只根据用户提供的材料生成可追溯的综述素材，不代写论文，不编造材料。"
        },
        {
          role: "user",
          content: [
            "请基于以下论文题录、摘要和关键词生成快速综述素材。",
            "输出应包含：主题分类、代表论文、反复出现的观点、可能的研究空白、建议下载全文精读的论文。",
            "所有判断尽量引用论文ID。",
            "",
            "【论文材料开始】",
            papers.map(paperBrief).join("\n\n---\n\n"),
            "【论文材料结束】"
          ].join("\n")
        }
      ]);
    },

    async generateDeepReview(papers) {
      return client.createChatCompletion([
        {
          role: "system",
          content: "你是严谨的中文学术文献综述助手。你会基于多篇论文全文生成可追溯的深度综述素材，不代写论文，不编造材料。"
        },
        {
          role: "user",
          content: [
            "请基于以下论文题录、摘要、关键词和 PDF 全文生成深度综述素材。",
            "输出应包含：单篇结构化分析、方法与数据对比、研究脉络、代表论文、共同不足、研究空白、可写入综述的素材段落。",
            "所有判断必须尽量引用论文ID。",
            "",
            "【论文材料开始】",
            papers.map(paperFullTextBlock).join("\n\n---\n\n"),
            "【论文材料结束】"
          ].join("\n")
        }
      ]);
    }
  };
}
