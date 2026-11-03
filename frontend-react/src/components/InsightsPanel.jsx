import { ArrowDown, ArrowRight, ArrowUp, BarChart3, Flag, Gauge, Hash, ListChecks, Tag, Workflow, X } from "lucide-react";

import { FOLLOW_UPS, intentLabel } from "../lib/intents.js";
import { formatCount } from "../lib/tokens.js";

function InsightRow({ icon: Icon, label, value, tone }) {
  return (
    <div className="insight-row">
      <Icon size={16} className={`insight-icon ${tone ? `text-${tone}` : ""}`} />
      <span className="insight-label">{label}</span>
      <span className="insight-value">{value}</span>
    </div>
  );
}

const LEVEL_TONE = { low: "success", medium: "warning", high: "danger", unknown: "muted" };

/** Slide-over panel showing how the latest message was classified. */
export default function InsightsPanel({ analysis, tokenUsage, onAsk, onClose, disabled }) {
  return (
    <aside className="insights-drawer" aria-label="Message insights">
      <div className="insights-head">
        <BarChart3 size={19} className="text-primary" />
        <h2>Message Insights</h2>
        <span className={`soft-badge ${analysis ? "is-live" : ""}`}>{analysis ? "Live" : "Waiting"}</span>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Close insights">
          <X size={17} />
        </button>
      </div>

      {analysis ? (
        <>
          <div className="insight-summary">
            <strong>{intentLabel(analysis.intent)}</strong>
            <p>{analysis.summary}</p>
          </div>

          <p className="section-label">Detected classification</p>
          <div className="insight-rows">
            <InsightRow icon={Tag} label="Intent" value={analysis.intent} />
            <InsightRow icon={Gauge} label="Risk profile" value={analysis.risk_profile} tone={LEVEL_TONE[analysis.risk_profile]} />
            <InsightRow icon={Flag} label="Priority" value={analysis.priority} tone={LEVEL_TONE[analysis.priority]} />
            <InsightRow icon={ListChecks} label="Requires action" value={analysis.requires_action ? "yes" : "no"} />
          </div>

          <p className="section-label">Tokens for this message</p>
          {tokenUsage ? (
            <div className="insight-rows">
              <InsightRow
                icon={ArrowUp}
                label="Input (total)"
                value={formatCount(tokenUsage.input_tokens, tokenUsage.estimated)}
              />
              <InsightRow
                icon={ArrowDown}
                label="Output (total)"
                value={formatCount(tokenUsage.output_tokens, tokenUsage.estimated)}
              />
              <InsightRow
                icon={Tag}
                label="Intent detection"
                value={`${formatCount(tokenUsage.classification.input_tokens, tokenUsage.classification.estimated)} / ${formatCount(tokenUsage.classification.output_tokens, tokenUsage.classification.estimated)}`}
              />
              <InsightRow
                icon={Hash}
                label="Reply"
                value={`${formatCount(tokenUsage.reply.input_tokens, tokenUsage.reply.estimated)} / ${formatCount(tokenUsage.reply.output_tokens, tokenUsage.reply.estimated)}`}
              />
            </div>
          ) : (
            <p className="insights-note">Shown when the reply finishes.</p>
          )}

          <p className="section-label">Suggested follow-ups</p>
          <div className="follow-ups">
            {(FOLLOW_UPS[analysis.intent] ?? FOLLOW_UPS.unknown).map((prompt) => (
              <button key={prompt} type="button" className="follow-up" onClick={() => onAsk(prompt)} disabled={disabled}>
                <span>{prompt}</span>
                <ArrowRight size={15} />
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="insights-empty">
          Send a message to see how it was classified: intent, risk, priority and token estimate.
        </div>
      )}

      <div className="pipeline-card">
        <span className="pipeline-icon">
          <Workflow size={18} />
        </span>
        <strong>How each reply is made</strong>
        <ol>
          <li>Understand what you need</li>
          <li>Check it against strict rules</li>
          <li>Write the answer using your recent messages</li>
        </ol>
      </div>
    </aside>
  );
}
