import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';

export const OrganizationChat: React.FC<{ peerOrgId?: string; peerOrgName?: string }> = ({ peerOrgId, peerOrgName }) => {
  const { currentUser, addToast } = useApp();
  const [messages, setMessages] = useState<any[]>([]);
  const [body, setBody] = useState('');
  const [authorized, setAuthorized] = useState(!peerOrgId);

  useEffect(() => {
    if (!peerOrgId) { setAuthorized(true); return; }
    api.partnerChats().then(({ partners }) => setAuthorized(partners.some((partner) => partner.id === peerOrgId))).catch(() => setAuthorized(false));
  }, [peerOrgId]);

  const refresh = useCallback(() => {
    const call = peerOrgId ? api.partnerMessages(peerOrgId) : api.chatMessages();
    call.then(({ messages: latest }) => setMessages(latest)).catch(() => setMessages([]));
  }, [peerOrgId]);

  useEffect(() => {
    if (!authorized) return;
    refresh();
    const timer = window.setInterval(refresh, 8000);
    return () => window.clearInterval(timer);
  }, [refresh, authorized]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const message = body.trim();
    if (!message) return;
    try {
      if (peerOrgId) await api.postPartnerMessage(peerOrgId, message);
      else await api.postChatMessage(message);
      setBody('');
      refresh();
    } catch (error) {
      addToast({ type: 'error', title: 'Message Not Sent', message: error instanceof Error ? error.message : 'Could not post message.' });
    }
  };

  if (!authorized) return <section className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500">Partner chat is available when an active Full Collaboration grant connects these organizations.</section>;

  return <section className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
    <div><h2 className="text-sm font-bold text-slate-900 dark:text-white">{peerOrgId ? `Partner chat with ${peerOrgName}` : 'Organization chat'}</h2><p className="text-xs text-slate-500">{peerOrgId ? `Visible to members of ${currentUser.organizationName} and ${peerOrgName}.` : `Visible to signed-in members of ${currentUser.organizationName}.`}</p></div>
    <div className="max-h-72 min-h-24 overflow-y-auto space-y-2" aria-live="polite">
      {!messages.length && <p className="text-xs text-slate-400">No messages yet.</p>}
      {messages.map((message) => <article key={message.id} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60">
        <div className="flex justify-between gap-3 text-[11px]"><strong className="text-slate-700 dark:text-slate-200">{message.userName}{message.organizationName ? ` · ${message.organizationName}` : ''}</strong><time className="text-slate-400">{new Date(message.createdAt).toLocaleString()}</time></div>
        <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words mt-1">{message.body}</p>
      </article>)}
    </div>
    <form onSubmit={submit} className="flex gap-2">
      <input value={body} maxLength={4000} onChange={(event) => setBody(event.target.value)} placeholder="Write a message" className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs" />
      <button disabled={!body.trim()} className="px-3 py-2 rounded-lg bg-blue-600 disabled:opacity-50 text-white text-xs font-semibold">Send</button>
    </form>
  </section>;
};
