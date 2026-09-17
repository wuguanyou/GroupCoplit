'use client';
import { useState, useEffect } from 'react';
import {
  FolderOpen,
  ArrowRight,
  Users,
  FileCheck,
  ShieldCheck,
  Plus,
} from 'lucide-react';
import { ProjectContext } from './project-context';
import Dashboard from './dashboard';
type Session = {
  user: { id: string; name: string } | null;
  projects: { id: string; name: string; role: string }[];
  selected?: string | null;
};
export function WorkspaceGate({ signInPath }: { signInPath: string }) {
  const [session, setSession] = useState<Session | null>(null),
    [chooser, setChooser] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [mode, setMode] = useState('create');
  const load = async () => {
    const r = await fetch('/api/workspace', { cache: 'no-store' });
    const j: any = await r.json();
    if (!r.ok) throw Error(j.error);
    setSession(j);
  };
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  async function act(values: Record<string, unknown>) {
    setBusy(true);
    setError('');
    try {
      const r = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const j: any = await r.json();
      if (!r.ok) throw Error(j.error);
      await load();
      setChooser(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (session?.user && session.selected && !chooser)
    return (
      <ProjectContext.Provider value={session.selected}>
        <Dashboard
          key={session.selected}
          onWorkspace={() => setChooser(true)}
        />
      </ProjectContext.Provider>
    );
  return (
    <div className="entry-page">
      <section className="entry-story">
        <a href="/" className="brand">
          ◈ GroupPilot
        </a>
        <span className="eyebrow">一起開始，一起完成</span>
        <h1>
          讓每一份工作，
          <br />
          都有歸屬。
        </h1>
        <p>
          從老師的作業要求，到團隊最後一次交付。把檔案、任務和每個人的付出，放在同一個地方。
        </p>
        <div className="entry-features">
          <div>
            <FolderOpen />
            <span>
              <b>專案資料庫</b>集中保存要求、參考資料與文件
            </span>
          </div>
          <div>
            <FileCheck />
            <span>
              <b>任務交付中心</b>提交附件、交叉驗收、留下貢獻
            </span>
          </div>
          <div>
            <Users />
            <span>
              <b>團隊專屬空間</b>登入後建立專案，邀請組員加入
            </span>
          </div>
        </div>
        <small>GroupPilot · 學生團隊協作</small>
      </section>
      <section className="entry-form">
        {error && (
          <div className="error" role="alert">
            {error}
            <button onClick={() => load().catch((e) => setError(e.message))}>
              重試
            </button>
          </div>
        )}
        {!session ? (
          <p>正在確認登入狀態…</p>
        ) : !session.user ? (
          <div className="login-card">
            <span className="entry-icon">
              <ShieldCheck size={28} />
            </span>
            <p className="eyebrow">歡迎回來</p>
            <h2>進入你的團隊工作空間</h2>
            <p>使用 ChatGPT 帳號登入，建立自己的專案與檔案資料庫。</p>
            <a
              className="btn primary login-link"
              href={signInPath}
              target="_top"
            >
              使用 ChatGPT 登入 <ArrowRight size={18} />
            </a>
            <small>只有加入專案的成員，才能查看其中的資料與檔案。</small>
          </div>
        ) : (
          <div className="workspace-setup">
            <p className="eyebrow">{session.user.name}</p>
            <h2>選擇你的工作空間</h2>
            {session.projects.length > 0 && (
              <div className="project-choices">
                {session.projects.map((p) => (
                  <button
                    className="project-choice"
                    disabled={busy}
                    key={p.id}
                    onClick={() => act({ action: 'select', projectId: p.id })}
                  >
                    <FolderOpen />
                    <span>
                      <b>{p.name}</b>
                      <small>
                        {p.role === 'owner' ? '專案建立者' : '團隊成員'}
                      </small>
                    </span>
                    <ArrowRight size={16} />
                  </button>
                ))}
              </div>
            )}
            <div className="segmented">
              <button
                className={mode === 'create' ? 'selected' : ''}
                onClick={() => setMode('create')}
              >
                建立新專案
              </button>
              <button
                className={mode === 'join' ? 'selected' : ''}
                onClick={() => setMode('join')}
              >
                加入團隊
              </button>
            </div>
            <form
              key={mode}
              onSubmit={(e) => {
                e.preventDefault();
                act({
                  action: mode,
                  ...Object.fromEntries(new FormData(e.currentTarget)),
                });
              }}
            >
              <label>
                在團隊中顯示的姓名
                <input
                  name="displayName"
                  required
                  maxLength={60}
                  defaultValue={session.user.name.split('@')[0]}
                />
              </label>
              {mode === 'create' ? (
                <>
                  <label>
                    專案名稱
                    <input
                      name="name"
                      required
                      maxLength={100}
                      placeholder="例如：校園智慧導覽"
                    />
                  </label>
                  <label>
                    作業要求與目標
                    <textarea
                      name="requirements"
                      required
                      maxLength={12000}
                      placeholder="貼上老師的要求；建立後也能上傳相關檔案。"
                    />
                  </label>
                  <label>
                    截止日期
                    <input
                      type="date"
                      name="deadline"
                      required
                      min={new Date().toISOString().slice(0, 10)}
                    />
                  </label>
                </>
              ) : (
                <label>
                  團隊邀請碼
                  <input
                    name="code"
                    required
                    maxLength={80}
                    placeholder="貼上專案建立者提供的邀請碼"
                  />
                </label>
              )}
              <button className="btn primary" disabled={busy}>
                <Plus size={17} />
                {busy
                  ? '處理中…'
                  : mode === 'create'
                    ? '建立空白專案'
                    : '加入專案'}
              </button>
            </form>
            <a
              className="signout"
              href="/signout-with-chatgpt?return_to=%2F"
              target="_top"
            >
              登出
            </a>
          </div>
        )}
      </section>
    </div>
  );
}
