import { useEffect, useRef } from "react";
import { AlertCircle, ArrowDown, ArrowUp, CircleStop, Timer } from "lucide-react";

import CopyButton from "./CopyButton.jsx";
import Markdown from "./Markdown.jsx";
import { intentLabel } from "../lib/intents.js";
import { formatTime } from "../lib/time.js";
import { formatCount, formatDuration, usageBreakdown } from "../lib/tokens.js";

function UserMessage({ message }) {
  return (
    <div className="msg-user">
      <div className={`user-bubble ${message.failed ? "is-failed" : ""}`}>{message.content}</div>
      <span className="msg-meta">
        {message.failed ? (
          <span className="msg-failed">
            <AlertCircle size={13} /> Not sent
          </span>
        ) : (
          formatTime(message.createdAt)
        )}
      </span>
    </div>
  );
}

function AssistantMessage({ message }) {
  const { analysis, streaming, stopped, interrupted, tokenUsage, timing } = message;

  return (
    <div className="msg-assistant">
      <span className={`orb orb-sm ${streaming ? "is-thinking" : ""}`} aria-hidden="true" />
      <div className="assistant-body">
        <div className="assistant-head">
          <span className="assistant-name">Indigo.ai</span>
          {analysis && <span className="intent-badge">{intentLabel(analysis.intent)}</span>}
          <span className="msg-time">{formatTime(message.createdAt)}</span>
        </div>

        {message.content ? (
          <div className={streaming ? "is-streaming" : undefined}>
            <Markdown>{message.content}</Markdown>
          </div>
        ) : (
          <span className="caret-only" aria-label="Writing" />
        )}

        {!streaming && (
          <div className="assistant-actions">
            {message.content && <CopyButton text={message.content} label="Copy" />}
            {(stopped || interrupted) && (
              <span className="msg-note">
                <CircleStop size={13} /> {stopped ? "Stopped" : "Interrupted"} · not saved
              </span>
            )}
            {(tokenUsage || timing) && (
              <span className="reply-meta">
                {tokenUsage && (
                  <span className="reply-meta-item" title={usageBreakdown(tokenUsage)}>
                    <ArrowUp size={12} /> {formatCount(tokenUsage.input_tokens, tokenUsage.estimated)} in
                  </span>
                )}
                {tokenUsage && (
                  <span className="reply-meta-item" title={usageBreakdown(tokenUsage)}>
                    <ArrowDown size={12} /> {formatCount(tokenUsage.output_tokens, tokenUsage.estimated)} out
                  </span>
                )}
                {timing && (
                  <span
                    className="reply-meta-item"
                    title={`First word after ${formatDuration(timing.firstTokenMs)} · finished in ${formatDuration(timing.totalMs)}`}
                  >
                    <Timer size={12} /> {formatDuration(timing.totalMs)}
                  </span>
                )}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ThinkingMessage() {
  return (
    <div className="msg-assistant">
      <span className="orb orb-sm is-thinking" aria-hidden="true" />
      <div className="thinking">
        <span className="thinking-text">Understanding your message…</span>
        <span className="thinking-note">Detecting intent before replying</span>
      </div>
    </div>
  );
}

export default function MessageList({ messages, waitingForAnalysis }) {
  const endRef = useRef(null);
  const last = messages[messages.length - 1];

  // New message: scroll to it.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, waitingForAnalysis]);

  // While text streams in, follow it, but only if the reader is already near the bottom.
  useEffect(() => {
    const scroller = endRef.current?.closest(".chat-scroll");
    if (!scroller) return;
    const distanceFromBottom = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    if (distanceFromBottom < 160) scroller.scrollTop = scroller.scrollHeight;
  }, [last?.content]);

  return (
    <div className="message-list" aria-live="polite" aria-busy={Boolean(last?.streaming || waitingForAnalysis)}>
      {messages.map((message) =>
        message.role === "user" ? (
          <UserMessage key={message.id} message={message} />
        ) : (
          <AssistantMessage key={message.id} message={message} />
        ),
      )}
      {waitingForAnalysis && <ThinkingMessage />}
      <div ref={endRef} />
    </div>
  );
}
