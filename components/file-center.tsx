'use client';
import { useProjectFetch, useProjectId } from './project-context';
import { useEffect, useState, useRef, useId } from 'react';
import { Upload, Download, FileText, FolderOpen } from 'lucide-react';
import type { Project } from '../lib/project';
type Item = {
  id: string;
  name: string;
  size: number;
  category: string;
  task_id: string;
  uploader: string;
  created_at: string;
};
const types = '.pdf,.docx,.pptx,.xlsx,.txt,.md,.csv,.png,.jpg,.jpeg,.zip';
async function list(apiFetch: ReturnType<typeof useProjectFetch>) {
  const r = await apiFetch('/api/files', { cache: 'no-store' });
  const j: any = await r.json();
  if (!r.ok) throw Error(j.error);
  return j.files as Item[];
}
export function UploadFile({
  category,
  taskId = '',
  onDone,
}: {
  category: string;
  taskId?: string;
  onDone: (f: Item) => void;
}) {
  const apiFetch = useProjectFetch(),
    projectId = useProjectId();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [status, setStatus] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = useId();
  const needsTask = category === 'submission' && !taskId;
  return (
    <div className="upload-box" aria-busy={busy}>
      <div className="upload-icon"><Upload size={23} aria-hidden="true" /></div>
      <b>{busy ? '正在上傳檔案' : '上傳團隊檔案'}</b>
      <p className="upload-formats" id={hintId}>支援 PDF、Office、文字、圖片與 ZIP<br />每次選擇一個檔案，上限 10 MB</p>
      <button type="button" className="btn primary upload-button" disabled={busy || needsTask} aria-describedby={hintId} onClick={() => inputRef.current?.click()}>
        <Upload size={16} aria-hidden="true" />{busy ? '上傳中…' : '選擇檔案並上傳'}
      </button>
      {needsTask && <p className="upload-status">請先選擇所屬任務，再上傳交付檔案。</p>}
      <p className="upload-status" role="status">{status}</p>
      <input
        ref={inputRef}
        hidden
        aria-label="選擇上傳檔案"
        type="file"
        accept={types}
        disabled={busy || needsTask}
        onChange={async (e) => {
          const input = e.currentTarget,
            f = input.files?.[0];
          if (!f) return;
          setStatus('');
          if (f.size > 10 * 1024 * 1024) {
            setError('每個檔案上限 10 MB');
            input.value = '';
            return;
          }
          setBusy(true);
          setError('');
          setStatus('正在上傳：' + f.name);
          try {
            const body = new FormData();
            body.set('file', f);
            body.set('category', category);
            body.set('taskId', taskId);
            const r = await apiFetch('/api/files', { method: 'POST', body });
            const j: any = await r.json();
            if (!r.ok) throw Error(j.error);
            onDone(j.file);
            setStatus('已上傳：' + f.name);
          } catch (e) {
            setStatus('');
            setError((e as Error).message);
          } finally {
            input.value = '';
            setBusy(false);
          }
        }}
      />
      {error && (
        <p role="alert" className="file-error">
          {error}
        </p>
      )}
    </div>
  );
}
export function AttachmentPicker({
  taskId,
  userId,
  value,
  onChange,
}: {
  taskId: string;
  userId: string;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  const apiFetch = useProjectFetch(),
    projectId = useProjectId();
  const [files, setFiles] = useState<Item[]>([]),
    [error, setError] = useState('');
  useEffect(() => {
    list(apiFetch)
      .then(setFiles)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <div className="attachment-picker">
      <label>交付附件（選填，最多 10 個）</label>
      <UploadFile
        category="submission"
        taskId={taskId}
        onDone={(f) => {
          setFiles((v) => [f, ...v]);
          onChange([...value, f.id].slice(0, 10));
        }}
      />
      {error && <p role="alert">{error}</p>}
      {files
        .filter(
          (f) =>
            f.category === 'submission' &&
            f.task_id === taskId &&
            f.uploader === userId,
        )
        .map((f) => (
          <label className="attachment-check" key={f.id}>
            <input
              type="checkbox"
              checked={value.includes(f.id)}
              disabled={!value.includes(f.id) && value.length >= 10}
              onChange={(e) =>
                onChange(
                  e.target.checked
                    ? [...value, f.id]
                    : value.filter((id) => id !== f.id),
                )
              }
            />
            {f.name}
          </label>
        ))}
    </div>
  );
}
export function EvidenceAttachments({ ids }: { ids: string[] }) {
  const apiFetch = useProjectFetch(),
    projectId = useProjectId();
  const [files, setFiles] = useState<Item[]>([]);
  useEffect(() => {
    if (ids.length)
      list(apiFetch)
        .then(setFiles)
        .catch(() => {});
  }, [ids.join(',')]);
  return (
    <div className="file-links">
      {ids.map((id) => (
        <a
          key={id}
          href={
            '/api/files?project=' +
            encodeURIComponent(projectId) +
            '&id=' +
            encodeURIComponent(id)
          }
        >
          <Download size={14} />
          {files.find((f) => f.id === id)?.name ?? '下載附件'}
        </a>
      ))}
    </div>
  );
}
export function FileCenter({
  project,
  userId,
  onSubmit,
}: {
  project: Project;
  userId: string;
  onSubmit: (taskId: string) => void;
}) {
  const apiFetch = useProjectFetch(),
    projectId = useProjectId();
  const [files, setFiles] = useState<Item[]>([]),
    [category, setCategory] = useState('reference'),
    [taskId, setTaskId] = useState(''),
    [query, setQuery] = useState(''),
    [error, setError] = useState('');
  const load = () =>
    list(apiFetch)
      .then(setFiles)
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  const filtered = files.filter(
    (f) =>
      f.category === category &&
      (!taskId || f.task_id === taskId) &&
      f.name.toLowerCase().includes(query.toLowerCase()),
  );
  const status = (f: Item) => {
    const e = project.evidence.filter((e) => e.fileIds?.includes(f.id));
    return e.some((e) => e.status === 'accepted')
      ? '已驗收'
      : e.some((e) => e.status === 'pending')
        ? '待驗收'
        : e.length
          ? '已退回'
          : '尚未送驗收';
  };
  return (
    <section className="panel file-center">
      <div className="panel-title">
        <div>
          <h2>團隊檔案中心</h2>
          <p>要求與參考資料集中保存；交付檔案連結任務與驗收紀錄。</p>
        </div>
        <span className="badge neutral">{files.length} 個檔案</span>
      </div>
      <div className="segmented">
        <button
          className={category === 'reference' ? 'selected' : ''}
          onClick={() => {
            setCategory('reference');
            setTaskId('');
          }}
        >
          <FolderOpen size={16} />
          專案資料
        </button>
        <button
          className={category === 'submission' ? 'selected' : ''}
          onClick={() => setCategory('submission')}
        >
          <FileText size={16} />
          任務交付彙整
        </button>
      </div>
      <div className="file-toolbar">
        <label>
          搜尋檔名
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋文件、簡報或交付檔案"
          />
        </label>
        {category === 'submission' && (
          <label>
            所屬任務
            <select value={taskId} onChange={(e) => setTaskId(e.target.value)}>
              <option value="">全部任務（上傳前請先選擇）</option>
              {project.tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <UploadFile category={category} taskId={taskId} onDone={() => load()} />
      <div className="file-help">
        <p><strong>檔案保存</strong>上傳後會保存原始檔案；交付成果需另按「提交驗收」。</p>
        <p><strong>AI 分析範圍</strong>目前依「專案設定」的文字要求分析，尚不自動解析附件內容。</p>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!filtered.length ? (
        <div className="file-empty">
          <FolderOpen size={30} />
          <h3>這裡還沒有檔案</h3>
          <p>
            {category === 'reference'
              ? '先上傳老師的作業要求或團隊參考文件。'
              : '選擇任務後上傳成果，或從任務卡片提交驗收。'}
          </p>
        </div>
      ) : (
        <div className="file-grid">
          {filtered.map((f) => (
            <article className="file-card" key={f.id}>
              <FileText size={25} />
              <h3>{f.name}</h3>
              <p>
                {project.members.find((m) => m.id === f.uploader)?.name ??
                  '組員'}{' '}
                · {(f.size / 1024).toFixed(1)} KB
              </p>
              <small>{new Date(f.created_at).toLocaleString('zh-TW')}</small>
              {category === 'submission' && (
                <>
                  <p>
                    {project.tasks.find((t) => t.id === f.task_id)?.title ??
                      '任務'}
                  </p>
                  <span className="badge neutral">{status(f)}</span>
                </>
              )}
              <div className="actions">
                <a
                  className="btn"
                  href={
                    '/api/files?project=' +
                    encodeURIComponent(projectId) +
                    '&id=' +
                    encodeURIComponent(f.id)
                  }
                >
                  <Download size={15} />
                  下載
                </a>
                {category === 'submission' && f.uploader === userId && (
                  <button className="btn" onClick={() => onSubmit(f.task_id)}>
                    提交驗收
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
