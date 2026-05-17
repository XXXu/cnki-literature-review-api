export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type DeepSeekClientOptions = {
  apiKey: string;
  baseUrl: string;
  model: string;
  fetcher?: typeof fetch;
};

type ChatCompletionsResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

export function createDeepSeekClient(options: DeepSeekClientOptions) {
  const fetcher = options.fetcher ?? fetch;
  const baseUrl = options.baseUrl.replace(/\/+$/g, "");

  return {
    async createChatCompletion(messages: ChatMessage[]) {
      if (!options.apiKey) {
        throw new Error("DEEPSEEK_API_KEY_MISSING");
      }

      const response = await fetcher(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${options.apiKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: options.model,
          messages,
          temperature: 0.2
        })
      });

      const body = await response.json() as ChatCompletionsResponse;
      if (!response.ok) {
        throw new Error(body.error?.message ?? `DEEPSEEK_REQUEST_FAILED_${response.status}`);
      }

      const content = body.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("DEEPSEEK_EMPTY_RESPONSE");
      }
      return content;
    }
  };
}
