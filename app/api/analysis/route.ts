import { readProject } from '../../../db/store';
import { analyzeWithAI } from '../../../lib/ai';
export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    if (origin && origin !== new URL(request.url).origin)
      return Response.json({ error: '來源不符' }, { status: 403 });
    const { project } = await readProject();
    return Response.json({ analysis: await analyzeWithAI(project) });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'AI 分析失敗' },
      { status: 503 },
    );
  }
}
