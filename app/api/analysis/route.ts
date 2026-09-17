// Legacy endpoint: require the same operator authentication and quota-controlled pipeline.
import { handleAgent } from '../../../lib/agent-service';
import { readProject } from '../../../db/store';
export async function POST(request: Request) {
  const { revision } = await readProject();
  return handleAgent(
    new Request(request.url, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify({
        action: 'run',
        kind: 'analysis',
        requestId: crypto.randomUUID(),
        revision,
        note: '',
        autoApply: false,
      }),
    }),
  );
}
