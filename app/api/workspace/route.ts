import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';
import { getChatGPTUser } from '../../chatgpt-auth';
import {
  access,
  requireUser,
  sameOrigin,
  apiError,
  AccessError,
  owner,
} from '../../../lib/access';
import { day, log, type Project } from '../../../lib/project';
import { text, validDate, object } from '../../../lib/agent-contracts';
export async function GET() {
  try {
    const user = await getChatGPTUser();
    if (!user)
      return Response.json(
        { user: null, projects: [] },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    const rows = await env.DB.prepare(
      'SELECT p.id, p.data, m.role FROM projects p JOIN project_members m ON m.project_id = p.id WHERE m.user_id = ?',
    )
      .bind(user.userId)
      .all<{ id: string; data: string; role: string }>();
    const selected = (await cookies()).get('gp_project')?.value;
    return Response.json(
      {
        user: { id: user.userId, name: user.displayName },
        projects: rows.results.map((r) => ({
          id: r.id,
          name: JSON.parse(r.data).name,
          role: r.role,
        })),
        selected: rows.results.some((r) => r.id === selected) ? selected : null,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    const b = object(await request.json());
    let projectId = '';
    if (b.action === 'create') {
      const count = await env.DB.prepare(
        'SELECT COUNT(*) AS n FROM project_members WHERE user_id = ?',
      )
        .bind(user.userId)
        .first<{ n: number }>();
      if ((count?.n ?? 0) >= 20)
        throw new AccessError('最多加入或建立 20 個專案', 400);
      projectId = crypto.randomUUID();
      const name = text(b.name, 100),
        displayName = text(b.displayName, 60),
        deadline = validDate(b.deadline);
      if (deadline < day()) throw new AccessError('截止日不可早於今天', 400);
      const p: Project = {
        name,
        requirements: text(b.requirements, 12000),
        deadline,
        members: [
          {
            id: user.userId,
            name: displayName,
            role: '專案建立者',
            skills: ['planning'],
            preference: 'planning',
            dailyHours: 2,
            unavailableUntil: day(),
            color: '#3b8b77',
          },
        ],
        tasks: [],
        evidence: [],
        events: [],
        auto: true,
        lastCheck: new Date().toISOString(),
        demo: false,
      };
      log(p, '專案已建立', '加入組員、上傳要求並建立任務。');
      await env.DB.batch([
        env.DB.prepare(
          'INSERT INTO projects (id,data,revision) VALUES (?,?,0)',
        ).bind(projectId, JSON.stringify(p)),
        env.DB.prepare(
          'INSERT INTO project_members (id,project_id,user_id,role) VALUES (?,?,?,?)',
        ).bind(crypto.randomUUID(), projectId, user.userId, 'owner'),
        env.DB.prepare(
          'INSERT INTO project_invites (project_id,token) VALUES (?,?)',
        ).bind(projectId, crypto.randomUUID()),
      ]);
    } else if (b.action === 'join') {
      const invite = await env.DB.prepare(
        'SELECT project_id FROM project_invites WHERE token = ?',
      )
        .bind(text(b.code, 80))
        .first<{ project_id: string }>();
      if (!invite) throw new AccessError('邀請碼無效或已更新', 400);
      projectId = invite.project_id;
      const existing = await env.DB.prepare(
        'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
      )
        .bind(projectId, user.userId)
        .first();
      if (!existing) {
        const row = await env.DB.prepare(
          'SELECT data,revision FROM projects WHERE id = ?',
        )
          .bind(projectId)
          .first<{ data: string; revision: number }>();
        if (!row) throw new AccessError('找不到專案', 404);
        const p = JSON.parse(row.data) as Project;
        if (p.members.length >= 30)
          throw new AccessError('團隊已達 30 人上限', 400);
        p.members.push({
          id: user.userId,
          name: text(b.displayName, 60),
          role: '組員',
          skills: ['planning'],
          preference: 'planning',
          dailyHours: 2,
          unavailableUntil: day(),
          color: '#5f86ba',
        });
        log(p, '新組員加入', p.members.at(-1)!.name);
        // The metadata insert and CAS update are one atomic D1 batch.
        const out = await env.DB.batch([
          env.DB.prepare(
            'INSERT INTO project_members (id,project_id,user_id,role) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM projects WHERE id = ? AND revision = ?)',
          ).bind(
            crypto.randomUUID(),
            projectId,
            user.userId,
            'member',
            projectId,
            row.revision,
          ),
          env.DB.prepare(
            'UPDATE projects SET data = ?, revision = revision + 1 WHERE id = ? AND revision = ?',
          ).bind(JSON.stringify(p), projectId, row.revision),
        ]);
        if (!out[1].meta.changes)
          throw new AccessError('團隊正在更新，請再次加入', 409);
      }
    } else if (b.action === 'select') {
      projectId = text(b.projectId, 80);
      const member = await env.DB.prepare(
        'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?',
      )
        .bind(projectId, user.userId)
        .first();
      if (!member) throw new AccessError('你不是這個專案的成員');
    } else if (b.action === 'invite') {
      const a = await access();
      owner(a.role);
      if (b.rotate === true)
        await env.DB.prepare(
          'UPDATE project_invites SET token = ? WHERE project_id = ?',
        )
          .bind(crypto.randomUUID(), a.projectId)
          .run();
      const row = await env.DB.prepare(
        'SELECT token FROM project_invites WHERE project_id = ?',
      )
        .bind(a.projectId)
        .first<{ token: string }>();
      return Response.json(
        { code: row?.token },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    } else throw new AccessError('操作無效', 400);
    const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
    return Response.json(
      { ok: true },
      {
        headers: {
          'Set-Cookie':
            'gp_project=' +
            projectId +
            '; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000' +
            secure,
        },
      },
    );
  } catch (e) {
    if (e instanceof Error && !(e instanceof AccessError))
      return Response.json(
        { error: '請確認必填欄位，或重新載入再試。' },
        { status: 400 },
      );
    return apiError(e);
  }
}
