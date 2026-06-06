import { useEffect, useRef, useState } from 'react';
import { createSupabaseBrowserClient } from '~/lib/supabase/client';
import { SENDER_LABELS, type MessageRow } from '~/lib/threads';

type Props = {
  threadId: string;
  initialMessages: MessageRow[];
  viewerOrgId: string;
  buyerOrgId: string;
  sellerOrgId: string;
  isAdmin: boolean;
  threadClosed: boolean;
};

export default function MessageThread({
  threadId,
  initialMessages,
  viewerOrgId,
  buyerOrgId,
  sellerOrgId,
  isAdmin,
  threadClosed,
}: Props) {
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages);
  const [body, setBody] = useState('');
  const [visibleTo, setVisibleTo] = useState<'all' | 'buyer_side' | 'seller_side'>('all');
  const [status, setStatus] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`thread-${threadId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `thread_id=eq.${threadId}` },
        (payload) => {
          const row = payload.new as MessageRow;
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId]);

  const canPost =
    !threadClosed &&
    (isAdmin || viewerOrgId === buyerOrgId || viewerOrgId === sellerOrgId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || sending) return;
    setSending(true);
    setStatus('送信中…');

    const res = await fetch(`/api/threads/${threadId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body, visible_to: isAdmin ? visibleTo : 'all' }),
    });
    const json = await res.json();

    if (res.ok) {
      setBody('');
      setStatus('');
    } else {
      setStatus(json.error ?? '送信に失敗しました');
    }
    setSending(false);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 space-y-3 max-h-[28rem] overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
        {messages.length === 0 && (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-8">メッセージはまだありません</p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="rounded-xl bg-white border border-[var(--color-border)] px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mb-1">
              <span className="font-semibold text-[var(--color-text)]">
                {SENDER_LABELS[msg.sender_type] ?? msg.sender_type}
              </span>
              <span>{new Date(msg.created_at).toLocaleString('ja-JP')}</span>
              {isAdmin && msg.visible_to !== 'all' && (
                <span className="rounded bg-[var(--color-surface-muted)] px-1.5 py-0.5">
                  →{msg.visible_to === 'buyer_side' ? '買い手のみ' : '売り手のみ'}
                </span>
              )}
            </div>
            <p className="text-sm text-[var(--color-text)] whitespace-pre-wrap">{msg.body}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {!isAdmin && (
        <p className="mt-3 text-xs text-[var(--color-text-muted)] flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent-600)]" />
          運営が仲介中 — 匿名表示（合意後に連絡先が開示されます）
        </p>
      )}

      {canPost ? (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {isAdmin && (
            <div className="flex flex-wrap gap-3 text-sm">
              <label className="inline-flex items-center gap-1">
                <input type="radio" checked={visibleTo === 'all'} onChange={() => setVisibleTo('all')} />
                双方
              </label>
              <label className="inline-flex items-center gap-1">
                <input type="radio" checked={visibleTo === 'buyer_side'} onChange={() => setVisibleTo('buyer_side')} />
                買い手のみ
              </label>
              <label className="inline-flex items-center gap-1">
                <input type="radio" checked={visibleTo === 'seller_side'} onChange={() => setVisibleTo('seller_side')} />
                売り手のみ
              </label>
            </div>
          )}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            placeholder="メッセージを入力"
            className="w-full rounded-xl border border-[var(--color-border)] px-3 py-2 text-sm"
            required
          />
          <button
            type="submit"
            disabled={sending}
            className="rounded-xl bg-[var(--brand-600)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            送信
          </button>
          {status && <p className="text-sm text-[var(--color-text-muted)]">{status}</p>}
        </form>
      ) : threadClosed ? (
        <p className="mt-4 text-sm text-[var(--color-text-muted)]">このスレッドは終了しています</p>
      ) : null}
    </div>
  );
}
