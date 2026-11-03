import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, Archive, ArchiveRestore, HelpCircle, X } from "lucide-react";

import ChatHeader from "../components/ChatHeader.jsx";
import ArchivedChatsDialog from "../components/ArchivedChatsDialog.jsx";
import DeleteChatDialog from "../components/DeleteChatDialog.jsx";
import Toast from "../components/Toast.jsx";
import { daysLeftLabel, formatDate } from "../lib/time.js";
import SearchChatsDialog from "../components/SearchChatsDialog.jsx";
import Composer from "../components/Composer.jsx";
import EmptyState from "../components/EmptyState.jsx";
import InsightsPanel from "../components/InsightsPanel.jsx";
import MessageList from "../components/MessageList.jsx";
import Sidebar from "../components/Sidebar.jsx";
import { useBackendStatus } from "../hooks/useBackendStatus.js";
import { api } from "../lib/api.js";

const newId = () => crypto.randomUUID();
const HISTORY_LIMIT = 12; // Same as the backend's memory window.

function downloadMarkdown(title, messages) {
  const lines = [`# ${title}`, ""];
  for (const message of messages) {
    const who = message.role === "user" ? "You" : "Indigo.ai";
    const when = message.createdAt ? ` · ${new Date(message.createdAt).toLocaleString()}` : "";
    lines.push(`### ${who}${when}`, "", message.content, "");
  }
  const fileName =
    title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "chat";

  const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/markdown" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName}.md`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function Chat() {
  const { sessionId } = useParams(); // undefined on /chat (a new or incognito conversation)
  const navigate = useNavigate();
  const { status, model } = useBackendStatus();

  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState(false); // a reply is in progress
  const [waitingForAnalysis, setWaitingForAnalysis] = useState(false); // before the first streamed text
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [error, setError] = useState("");
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [unseenInsights, setUnseenInsights] = useState(false);
  // Incognito chats live only in this component's state; the server stores nothing.
  const [incognito, setIncognito] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // chat waiting for "delete forever" confirmation
  // Archive: chats archived or deleted from the sidebar, removed for good after `retentionDays`.
  const [archived, setArchived] = useState({ items: [], retentionDays: 30, loading: false });
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [openChatArchive, setOpenChatArchive] = useState(null); // { archived_at, delete_at } if the open chat is archived
  const [toast, setToast] = useState(null);
  const closeToast = useCallback(() => setToast(null), []);
  const showToast = (message, actionLabel, onAction) => setToast({ id: newId(), message, actionLabel, onAction });

  const [searchOpen, setSearchOpen] = useState(false); // ChatGPT-style search card
  const abortRef = useRef(null); // AbortController of the reply in progress (Stop button)
  // Bumped whenever the visible chat changes, so late replies don't land in the wrong chat.
  const chatEpochRef = useRef(0);
  // Set when *we* navigate to a new chat's id, so we don't reload what's already shown.
  const skipHistoryLoadRef = useRef(null);

  const refreshConversations = useCallback(async () => {
    try {
      setConversations(await api.listConversations());
    } catch {
      // The sidebar keeps its previous list; the status card shows if the backend is down.
    }
  }, []);

  const refreshArchived = useCallback(async () => {
    setArchived((current) => ({ ...current, loading: true }));
    try {
      const data = await api.listArchived();
      setArchived({ items: data.items, retentionDays: data.retention_days, loading: false });
    } catch {
      setArchived((current) => ({ ...current, loading: false }));
    }
  }, []);

  useEffect(() => {
    refreshConversations();
    refreshArchived();
  }, [refreshConversations, refreshArchived]);

  // Ctrl/⌘+K focuses search (not in incognito, which has no sidebar);
  // Escape closes the insights panel and the mobile menu.
  const incognitoRef = useRef(incognito);
  incognitoRef.current = incognito;
  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        if (incognitoRef.current) return;
        event.preventDefault();
        setSearchOpen((open) => !open);
      } else if (event.key === "Escape") {
        setInsightsOpen(false);
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Warn before closing/refreshing the tab while an incognito chat exists (it would be lost).
  useEffect(() => {
    if (!incognito || messages.length === 0) return undefined;
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [incognito, messages.length]);

  // Load a saved conversation whenever the URL's session id changes.
  useEffect(() => {
    chatEpochRef.current += 1;
    setError("");
    setMobileMenuOpen(false);

    if (!sessionId) {
      setMessages([]);
      setOpenChatArchive(null);
      return undefined;
    }
    if (skipHistoryLoadRef.current === sessionId) {
      skipHistoryLoadRef.current = null;
      return undefined;
    }

    let cancelled = false;
    setMessages([]);
    setOpenChatArchive(null);
    setLoadingHistory(true);
    api
      .getConversation(sessionId)
      .then((data) => {
        if (cancelled) return;
        setOpenChatArchive(data.archive ?? null);
        setMessages(
          data.items.map((item) => ({ id: newId(), role: item.role, content: item.content, createdAt: item.created_at })),
        );
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoadingHistory(false));

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const sendMessage = async (text) => {
    const message = text.trim();
    if (!message || pending) return;

    const epoch = chatEpochRef.current;
    const isCurrent = () => chatEpochRef.current === epoch;
    const requestSession = sessionId;
    const isIncognito = incognito;
    // Incognito: the server keeps no history, so send the recent messages along.
    const history = isIncognito
      ? messages
          .filter((item) => item.content && !item.failed && !item.stopped && !item.interrupted)
          .slice(-HISTORY_LIMIT)
          .map(({ role, content }) => ({ role, content }))
      : undefined;

    const userMessage = { id: newId(), role: "user", content: message, createdAt: new Date().toISOString() };
    const assistantId = newId();
    let assistantAdded = false;

    setMessages((current) => [...current, userMessage]);
    setError("");
    setPending(true);
    setWaitingForAnalysis(true);

    const controller = new AbortController();
    abortRef.current = controller;

    // Response time, measured in the browser: send → first word, and send → finished.
    const startedAt = performance.now();
    let firstTokenMs = null;

    // Tokens arrive very fast; collect them and update the screen once per animation frame.
    let buffered = "";
    let frame = 0;
    const updateAssistant = (change) =>
      setMessages((current) => current.map((item) => (item.id === assistantId ? change(item) : item)));
    const flush = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      if (!buffered) return;
      const piece = buffered;
      buffered = "";
      updateAssistant((item) => ({ ...item, content: item.content + piece }));
    };

    try {
      const done = await api.analyzeStream(message, {
        sessionId: isIncognito ? undefined : requestSession,
        incognito: isIncognito,
        history,
        signal: controller.signal,
        onAnalysis: ({ type, session_id, ...analysis }) => {
          if (!isCurrent()) return;
          assistantAdded = true;
          setWaitingForAnalysis(false);
          setMessages((current) => [
            ...current,
            { id: assistantId, role: "assistant", content: "", createdAt: new Date().toISOString(), analysis, streaming: true },
          ]);
          setUnseenInsights(true);
        },
        onToken: (piece) => {
          if (firstTokenMs === null) firstTokenMs = performance.now() - startedAt;
          buffered += piece;
          if (!frame) frame = requestAnimationFrame(flush);
        },
      });

      flush();
      const timing = { totalMs: performance.now() - startedAt, firstTokenMs };
      updateAssistant((item) => ({ ...item, streaming: false, tokenUsage: done.token_usage ?? null, timing }));

      if (!isIncognito) {
        if (isCurrent() && done.session_id !== requestSession) {
          skipHistoryLoadRef.current = done.session_id;
          navigate(`/chat/${done.session_id}`);
        }
        refreshConversations();
        // Writing in an archived chat restores it on the server, so update the archive too.
        if (isCurrent() && openChatArchive) {
          setOpenChatArchive(null);
          refreshArchived();
        }
      }
    } catch (err) {
      flush();
      const stoppedByUser = err.name === "AbortError";
      if (assistantAdded) {
        updateAssistant((item) => ({ ...item, streaming: false, [stoppedByUser ? "stopped" : "interrupted"]: true }));
      } else {
        setMessages((current) => current.map((item) => (item.id === userMessage.id ? { ...item, failed: true } : item)));
      }
      if (!stoppedByUser && isCurrent()) setError(err.message);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setPending(false);
      setWaitingForAnalysis(false);
    }
  };

  const stopReply = () => abortRef.current?.abort();

  // Incognito chats are lost when you leave them, so ask first.
  const confirmLeavingIncognito = () =>
    !incognito || messages.length === 0 || window.confirm("Leave this incognito chat? It will be permanently deleted.");

  const clearChat = () => {
    chatEpochRef.current += 1;
    abortRef.current?.abort();
    setMessages([]);
    setError("");
    setInsightsOpen(false);
  };

  const startNewChat = () => {
    if (!confirmLeavingIncognito()) return;
    setMobileMenuOpen(false);
    if (incognito || !sessionId) clearChat();
    navigate("/chat");
  };

  const toggleIncognito = () => {
    if (incognito) {
      if (!confirmLeavingIncognito()) return;
      clearChat();
      setIncognito(false);
      return;
    }
    clearChat();
    setIncognito(true);
    if (sessionId) navigate("/chat");
  };

  const onSidebarNavigate = (event) => {
    if (incognito) {
      if (!confirmLeavingIncognito()) {
        event.preventDefault();
        return;
      }
      clearChat();
      setIncognito(false);
    }
    setMobileMenuOpen(false);
  };

  const toggleInsights = () => {
    setInsightsOpen((open) => !open);
    setUnseenInsights(false);
  };

  const latestReply = useMemo(() => [...messages].reverse().find((item) => item.analysis) ?? null, [messages]);

  const renameChat = async (id, title) => {
    const previous = conversations;
    setConversations((current) => current.map((item) => (item.session_id === id ? { ...item, title } : item)));
    try {
      await api.renameConversation(id, title);
    } catch (err) {
      setConversations(previous);
      setError(err.message);
    }
  };

  const restoreChat = async (id, { quiet = false } = {}) => {
    try {
      await api.restoreConversation(id);
      if (id === sessionId) setOpenChatArchive(null);
      await Promise.all([refreshConversations(), refreshArchived()]);
      if (!quiet) showToast("Chat restored.");
    } catch (err) {
      setError(err.message);
    }
  };

  /**
   * "Archive" and "Delete" in the ⋯ menu both move the chat to the archive (nothing is lost
   * straight away). It's deleted for good after the retention period, or from the archive.
   */
  const archiveChat = async (id, { fromDelete = false } = {}) => {
    try {
      await api.archiveConversation(id);
      setConversations((current) => current.filter((item) => item.session_id !== id));
      refreshArchived();
      if (id === sessionId) {
        clearChat();
        navigate("/chat");
      }
      const days = archived.retentionDays;
      showToast(
        fromDelete ? `Chat deleted. You can restore it from Archived chats for ${days} days.` : "Chat archived.",
        "Undo",
        () => restoreChat(id, { quiet: true }),
      );
    } catch (err) {
      setError(err.message);
    }
  };

  // "Delete forever" (from the archive) opens the type-the-name dialog first.
  const confirmDeleteForever = async () => {
    const id = deleteTarget.session_id;
    try {
      await api.deleteConversation(id);
      setDeleteTarget(null);
      await refreshArchived();
      if (id === sessionId) {
        clearChat();
        navigate("/chat");
      }
      showToast("Chat permanently deleted.");
    } catch (err) {
      setDeleteTarget(null);
      setError(err.message);
    }
  };

  const title = incognito
    ? "Incognito chat"
    : (conversations.find((item) => item.session_id === sessionId)?.title ??
      (messages[0]?.content.slice(0, 60) || "New chat"));

  useEffect(() => {
    document.title = `${title} · Indigo.ai`;
    return () => {
      document.title = "Indigo.ai";
    };
  }, [title]);

  const showWelcome = messages.length === 0 && !loadingHistory && !pending;

  const errorBanner = error && (
    <div className="error-banner" role="alert">
      <AlertTriangle size={16} />
      <span>{error}</span>
      <button type="button" className="icon-btn" onClick={() => setError("")} aria-label="Dismiss error">
        <X size={16} />
      </button>
    </div>
  );

  const composerProps = {
    onSend: sendMessage,
    onStop: stopReply,
    busy: pending,
    footerNote: incognito ? "Not saved: incognito" : "Remembers this chat",
  };

  return (
    <div className={`chat-page ${incognito ? "is-incognito" : ""}`}>
      <div
        className={`chat-shell ${incognito ? "no-sidebar" : ""} ${sidebarHidden ? "sidebar-hidden" : ""} ${mobileMenuOpen ? "menu-open" : ""}`}
      >
        {/* Incognito is a focused, full-width chat: no sidebar or history at all. */}
        {!incognito && (
          <>
            <Sidebar
              conversations={conversations}
              status={status}
              onOpenSearch={() => {
                setMobileMenuOpen(false);
                setSearchOpen(true);
              }}
              onNewChat={startNewChat}
              onCollapse={() => setSidebarHidden(true)}
              onNavigate={onSidebarNavigate}
              onRename={renameChat}
              onArchive={(id) => archiveChat(id)}
              onDelete={(id) => archiveChat(id, { fromDelete: true })}
              archivedCount={archived.items.length}
              onOpenArchive={() => {
                setMobileMenuOpen(false);
                setArchiveOpen(true);
                refreshArchived();
              }}
            />
            <button type="button" className="sidebar-scrim" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)} />
          </>
        )}

        <main className="chat-panel">
          <ChatHeader
            model={model}
            status={status}
            sidebarHidden={sidebarHidden}
            noSidebar={incognito}
            onShowSidebar={() => setSidebarHidden(false)}
            onOpenMenu={() => setMobileMenuOpen(true)}
            insightsOpen={insightsOpen}
            hasNewInsights={unseenInsights && !insightsOpen}
            onToggleInsights={toggleInsights}
            shareUrl={sessionId && !incognito ? `${window.location.origin}/chat/${sessionId}` : ""}
            onExport={() => downloadMarkdown(title, messages)}
            canExport={messages.some((item) => item.content)}
            incognito={incognito}
            onToggleIncognito={toggleIncognito}
            incognitoDisabled={pending}
          />

          <div className="chat-scroll">
            {openChatArchive && !loadingHistory && (
              <div className="archived-banner" role="status">
                <Archive size={16} />
                <span>
                  This chat is archived and will be deleted permanently {daysLeftLabel(openChatArchive.delete_at)} (
                  {formatDate(openChatArchive.delete_at)}). Sending a message restores it.
                </span>
                <button type="button" className="btn-line" onClick={() => restoreChat(sessionId)}>
                  <ArchiveRestore size={15} /> Restore
                </button>
              </div>
            )}
            {showWelcome ? (
              <EmptyState onPick={sendMessage} disabled={pending} incognito={incognito}>
                {errorBanner}
                <Composer
                  {...composerProps}
                  variant="hero"
                  placeholder={incognito ? "Ask anything. This chat won't be saved…" : "Ask me anything…"}
                />
              </EmptyState>
            ) : loadingHistory ? (
              <div className="history-loading">
                <span className="orb orb-sm is-thinking" aria-hidden="true" /> Loading conversation…
              </div>
            ) : (
              <MessageList messages={messages} waitingForAnalysis={waitingForAnalysis} />
            )}
          </div>

          {showWelcome ? (
            <>
              <p className="panel-foot">AI responses may not always be accurate. Please verify important information.</p>
              <Link to="/documentation" className="panel-help" aria-label="Documentation" title="Documentation">
                <HelpCircle size={18} />
              </Link>
            </>
          ) : (
            <div className="dock">
              {errorBanner}
              <Composer {...composerProps} variant="dock" placeholder="Ask a follow-up question…" />
              <p className="panel-foot">
                {incognito
                  ? "Incognito: this chat isn't saved and disappears when you leave."
                  : "AI responses may not always be accurate. Please verify important information."}
              </p>
            </div>
          )}

          {insightsOpen && (
            <InsightsPanel
              analysis={latestReply?.analysis ?? null}
              tokenUsage={latestReply?.tokenUsage ?? null}
              onAsk={sendMessage}
              onClose={() => setInsightsOpen(false)}
              disabled={pending}
            />
          )}
        </main>
      </div>

      {searchOpen && !incognito && (
        <SearchChatsDialog
          conversations={conversations}
          onClose={() => setSearchOpen(false)}
          onNewChat={() => {
            setSearchOpen(false);
            startNewChat();
          }}
          onSelect={(id) => {
            setSearchOpen(false);
            setMobileMenuOpen(false);
            if (id !== sessionId) navigate(`/chat/${id}`);
          }}
        />
      )}

      {archiveOpen && (
        <ArchivedChatsDialog
          items={archived.items}
          retentionDays={archived.retentionDays}
          loading={archived.loading}
          onClose={() => setArchiveOpen(false)}
          onRestore={(id) => restoreChat(id)}
          onOpen={(id) => {
            setArchiveOpen(false);
            if (id !== sessionId) navigate(`/chat/${id}`);
          }}
          onDeleteForever={(item) => setDeleteTarget(item)}
        />
      )}

      {deleteTarget && (
        <DeleteChatDialog
          title={deleteTarget.title}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={confirmDeleteForever}
        />
      )}

      <Toast toast={toast} onClose={closeToast} />
    </div>
  );
}
