'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useProjectFetch } from './project-context';
import type { ChatMessage } from '../lib/chat';
type HistoryResponse = { messages: ChatMessage[]; hasMore: boolean; error?: string };
export function TeamChat({ userId }: { userId: string }) {
  const apiFetch = useProjectFetch();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [older, setOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [following, setFollowing] = useState(true);
  const list = useRef<HTMLDivElement>(null);
  const pending = useRef<{body: string; nonce: string} | null>(null);
  const newest = useRef<number | null>(null);
  const merge = useCallback((incoming: ChatMessage[]) => setMessages(current => [...new Map([...current, ...incoming].map(m => [m.id, m])).values()].sort((a,b) => a.id-b.id)), []);
  useEffect(() => {
    let active = true, running = false, initial = true;
    const controller = new AbortController();
    async function refresh() {
      if (running) return;
      running = true;
      try {
        const r = await apiFetch(`/api/chat${newest.current === null ? '' : `?after=${newest.current}`}`, { cache: 'no-store', signal: controller.signal });
        const j = await r.json() as HistoryResponse;
        if (!r.ok) throw Error(j.error);
        if (active) { merge(j.messages); if(j.messages.length) newest.current=j.messages[j.messages.length-1].id; if(initial) setHasMore(j.hasMore); initial=false; }
      } catch(e) { if(active) setError(e instanceof Error ? e.message : '訊息更新失敗'); }
      finally { running=false; if(active) setLoading(false); }
    }
    void refresh();
    const timer = setInterval(() => { if(document.visibilityState === 'visible') void refresh(); }, 5000);
    return () => { active=false; controller.abort(); clearInterval(timer); };
  }, [apiFetch, merge]);
  useEffect(() => { if(following && list.current) list.current.scrollTop=list.current.scrollHeight; }, [messages, following]);
  async function loadOlder() {
    if (!messages.length || older) return;
    setOlder(true); setFollowing(false);
    try {
      const r=await apiFetch(`/api/chat?before=${messages[0].id}`, {cache:'no-store'});
      const j=await r.json() as HistoryResponse; if(!r.ok) throw Error(j.error);
      merge(j.messages); setHasMore(j.hasMore); setError('');
    } catch(e) { setError(e instanceof Error ? e.message : '載入失敗'); }
    finally {setOlder(false);}
  }
  async function send(e: React.FormEvent) {
    e.preventDefault(); if(sending || !body.trim()) return;
    setSending(true); setError('');
    const payload = pending.current?.body === body ? pending.current : {body, nonce:crypto.randomUUID()};
    pending.current=payload;
    try {
      const r=await apiFetch('/api/chat', {method:'POST', headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      const j=await r.json() as {message: ChatMessage; error?: string}; if(!r.ok) throw Error(j.error);
      merge([j.message]); setBody(''); pending.current=null; setFollowing(true);
    } catch(e) {setError(e instanceof Error ? e.message : '傳送失敗，請重試');}
    finally {setSending(false);}
  }
  return <section className="panel team-chat">
    <div className="panel-title"><div><h2>團隊聊天室</h2><p>與專案成員討論，訊息每 5 秒更新。訊息會保存供團隊查閱。</p></div></div>
    {error && <p role="alert" className="chat-error">{error}</p>}
    {hasMore && <button className="btn" onClick={loadOlder} disabled={older}>{older ? '載入中…' : '載入較早訊息'}</button>}
    <div className="chat-messages" ref={list} tabIndex={0} aria-label="團隊訊息" onScroll={() => { const el=list.current; if(el) setFollowing(el.scrollHeight-el.scrollTop-el.clientHeight<60); }}>
      {loading ? <p role="status">載入訊息中…</p> : !messages.length ? <p className="chat-empty">還沒有訊息，和團隊打個招呼吧！</p> : null}
      {messages.map(m => <article key={m.id} className={`chat-message ${m.userId === userId ? 'chat-own' : ''}`}><header><strong>{m.name}{m.userId === userId ? '（你）' : ''}</strong><time dateTime={m.createdAt}>{new Date(m.createdAt).toLocaleString('zh-TW')}</time></header><p>{m.body}</p></article>)}
    </div>
    {!following && <button className="btn" onClick={() => setFollowing(true)}>查看最新訊息 ↓</button>}
    <form className="chat-compose" onSubmit={send}><label htmlFor="team-message">輸入訊息</label><textarea id="team-message" value={body} onChange={e => setBody(e.target.value)} maxLength={2000} rows={3} disabled={sending} placeholder="討論進度、分享想法，或向組員求助…"/><div><small>{body.length} / 2000 · 可換行，按傳送送出</small><button className="btn primary" disabled={sending || !body.trim()}>{sending ? '傳送中…' : '傳送訊息'}</button></div></form>
  </section>;
}
