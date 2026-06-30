export type LlmMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type LlmRequest = {
  messages: LlmMessage[];
  responseFormat?: { type: 'json_object' };
  temperature?: number;
};

export type LlmClient = {
  complete(request: LlmRequest): Promise<unknown>;
};

export async function complete(request: LlmRequest): Promise<unknown> {
  const endpoint = process.env.LLM_ENDPOINT;

  if (!endpoint) {
    throw new Error('LLM_ENDPOINT is required to call the LLM client.');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.LLM_API_KEY
        ? { Authorization: `Bearer ${process.env.LLM_API_KEY}` }
        : {}),
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`LLM request failed with status ${response.status}`);
  }

  return response.json();
}
