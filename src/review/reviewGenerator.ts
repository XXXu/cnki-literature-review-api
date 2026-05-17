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
          content: "你是严谨的中文学术文献综述助手。快速综述只根据用户提供的论文题录、摘要和关键词生成可追溯的摘要级综述素材，不代写论文，不编造材料，不推断全文中的方法、数据或论证细节。"
        },
        {
          role: "user",
          content: [
            "请基于以下论文题录、摘要和关键词生成快速综述素材。",
            "这些材料不包含论文全文。请只做摘要级判断，不要推断论文的研究方法、论证过程、数据来源或材料细节。",
            "如果材料为英文或中英混合，请先理解原文含义，再用中文输出综述；专业术语、理论名称、模型名称和变量名称应保留英文原文，并在首次出现时给出中文解释。",
            "输出应包含：主题分类、代表性线索、反复出现的观点、可能的研究空白、建议优先核对或精读的论文。",
            "所有判断尽量引用论文ID；涉及代表性、贡献、不足时请使用“从题录和摘要看”“建议核对原文后确认”等限定表达。",
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
            "如果材料为英文或中英混合，请先理解原文含义，再用中文输出综述；专业术语、理论名称、模型名称和变量名称应保留英文原文，并在首次出现时给出中文解释。",
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
