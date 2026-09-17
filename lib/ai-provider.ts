export type AIEnvironment = Record<string, string | undefined>;
export type AIConfig = {
  enabled: boolean;
  protocol: 'responses' | 'chat';
  baseUrl: string;
  model: string;
  apiKey: string;
  operatorToken: string;
  format: 'json_schema' | 'json_object';
  dailyLimit: number;
};
export class AgentError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
export function getAIConfig(env: AIEnvironment): AIConfig {
  const legacy = !!env.OPENAI_MODEL && !env.AI_MODEL;
  const protocol = env.AI_PROTOCOL ?? (legacy ? 'responses' : 'chat');
  const format = env.AI_OUTPUT_FORMAT ?? 'json_schema';
  if (
    !['responses', 'chat'].includes(protocol) ||
    !['json_schema', 'json_object'].includes(format)
  )
    throw new AgentError('AI 協定設定無效', 503);
  const baseUrl = (
    env.AI_BASE_URL ?? (legacy ? 'https://api.openai.com/v1' : '')
  ).replace(/\/+$/, '');
  if (baseUrl) {
    let url: URL;
    try {
      url = new URL(baseUrl);
    } catch {
      throw new AgentError('AI 端點設定無效', 503);
    }
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new AgentError('AI 端點必須是無帳密或查詢參數的 HTTPS 網址', 503);
  }
  const rawLimit = Number(env.AI_DAILY_LIMIT ?? 20);
  return {
    enabled: env.AI_ENABLED === 'true',
    protocol: protocol as AIConfig['protocol'],
    baseUrl,
    model: env.AI_MODEL ?? env.OPENAI_MODEL ?? '',
    apiKey: env.AI_API_KEY ?? env.OPENAI_API_KEY ?? '',
    operatorToken: env.AI_OPERATOR_TOKEN ?? '',
    format: format as AIConfig['format'],
    dailyLimit:
      Number.isInteger(rawLimit) && rawLimit >= 1 && rawLimit <= 100
        ? rawLimit
        : 20,
  };
}
export function configStatus(c: AIConfig) {
  const missing = [];
  if (!c.enabled) missing.push('啟用 AI');
  if (!c.baseUrl) missing.push('模型端點');
  if (!c.model) missing.push('模型名稱');
  if (!c.apiKey) missing.push('模型金鑰');
  if (c.operatorToken.length < 24) missing.push('操作通行碼（至少 24 字元）');
  return {
    configured: !missing.length,
    missing,
    model: c.model,
    protocol: c.protocol,
    dailyLimit: c.dailyLimit,
  };
}
export async function authorizeAI(request: Request, c: AIConfig) {
  if (!configStatus(c).configured)
    throw new AgentError('AI 尚未完成設定；規則排程仍可使用。', 503);
  const supplied = request.headers.get('authorization') ?? '';
  const actual = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(supplied)),
  );
  const expected = new Uint8Array(
    await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode('Bearer ' + c.operatorToken),
    ),
  );
  let mismatch = 0;
  for (let i = 0; i < actual.length; i++) mismatch |= actual[i] ^ expected[i];
  if (mismatch) throw new AgentError('請輸入有效的 AI 操作通行碼。', 401);
}
export async function generateJSON(
  c: AIConfig,
  instructions: string,
  input: unknown,
  schema: Record<string, unknown>,
  fetcher: typeof fetch = fetch,
): Promise<unknown> {
  if (!configStatus(c).configured) throw new AgentError('AI 尚未完成設定', 503);
  const format =
    c.format === 'json_schema'
      ? { type: 'json_schema', name: 'grouppilot_result', strict: true, schema }
      : { type: 'json_object' };
  const system =
    instructions + '\n只輸出 JSON，必須符合此結構：' + JSON.stringify(schema);
  const body =
    c.protocol === 'responses'
      ? {
          model: c.model,
          store: false,
          instructions: system,
          input: JSON.stringify(input),
          max_output_tokens: 6000,
          text: { format },
        }
      : {
          model: c.model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: JSON.stringify(input) },
          ],
          max_tokens: 6000,
          response_format:
            c.format === 'json_schema'
              ? {
                  type: 'json_schema',
                  json_schema: {
                    name: 'grouppilot_result',
                    strict: true,
                    schema,
                  },
                }
              : { type: 'json_object' },
        };
  let response: Response;
  try {
    response = await fetcher(
      c.baseUrl +
        (c.protocol === 'responses' ? '/responses' : '/chat/completions'),
      {
        method: 'POST',
        redirect: 'error',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + c.apiKey,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(45000),
      },
    );
  } catch {
    throw new AgentError('模型連線失敗或逾時，未修改專案；請稍後重試。', 502);
  }
  if (!response.ok)
    throw new AgentError(
      response.status === 429
        ? '模型使用量或頻率受限，請稍後重試。'
        : '模型服務拒絕請求，請檢查模型、金鑰及輸出格式設定。',
      response.status === 429 ? 429 : 502,
    );
  const reader = response.body?.getReader();
  if (!reader) throw new AgentError('模型回應為空', 502);
  let raw = '',
    bytes = 0;
  const decoder = new TextDecoder();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > 200000) {
      await reader.cancel();
      throw new AgentError('模型回應過大，未執行任何操作。', 502);
    }
    raw += decoder.decode(value, { stream: true });
  }
  raw += decoder.decode();
  try {
    const data = JSON.parse(raw);
    let text: string | undefined;
    if (c.protocol === 'responses') {
      if (data.status !== 'completed') throw Error();
      text = data.output
        ?.flatMap((v: any) => v.content ?? [])
        .find((v: any) => v.type === 'output_text')?.text;
    } else {
      if (
        data.choices?.[0]?.finish_reason !== 'stop' ||
        data.choices[0].message?.refusal
      )
        throw Error();
      text = data.choices[0].message?.content;
    }
    if (typeof text !== 'string') throw Error();
    return JSON.parse(text);
  } catch {
    throw new AgentError('模型未傳回完整有效的 JSON，未執行任何操作。', 502);
  }
}
