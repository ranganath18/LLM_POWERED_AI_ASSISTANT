import { useState } from "react";
import {
  Compass,
  EyeOff,
  Ghost,
  KeyRound,
  Lightbulb,
  ListChecks,
  MessageSquareText,
  PackageSearch,
  PenLine,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";

// Everyday tasks the assistant handles well. Three are shown at random on each new chat.
const STARTER_POOL = [
  { icon: PenLine, title: "Write for me", prompt: "Write a short, polite email asking for a refund on a late order." },
  { icon: Lightbulb, title: "Explain simply", prompt: "Explain how online card payments are kept secure, in simple words." },
  { icon: ListChecks, title: "Make a checklist", prompt: "Give me a checklist for returning something I bought online." },
  { icon: ShieldCheck, title: "Stay safe", prompt: "How can I tell if a payment message or link is a scam?" },
  { icon: MessageSquareText, title: "Improve my message", prompt: "Make this sound more professional: \"where is my refund, it's been 2 weeks\"" },
  { icon: Compass, title: "Compare options", prompt: "What's the difference between a refund and a chargeback?" },
  { icon: KeyRound, title: "Fix an account issue", prompt: "I can't log in to my account. What should I try first?" },
  { icon: PackageSearch, title: "Delivery problem", prompt: "My parcel says delivered but I don't have it. What should I do?" },
  { icon: Sparkles, title: "Brainstorm", prompt: "Suggest 5 friendly ways to ask customer support for an update." },
];

/** Three random starters, avoiding the ones currently shown when possible. */
function pickStarters(current = []) {
  const shownTitles = new Set(current.map((item) => item.title));
  const fresh = STARTER_POOL.filter((item) => !shownTitles.has(item.title));
  const source = fresh.length >= 3 ? fresh : STARTER_POOL;
  return [...source].sort(() => Math.random() - 0.5).slice(0, 3);
}

const INCOGNITO_FACTS = [
  { icon: EyeOff, title: "Not saved", text: "This chat never reaches the database or your history." },
  { icon: Trash2, title: "Gone when you leave", text: "Refreshing, leaving or turning incognito off deletes it." },
  { icon: Ghost, title: "Still smart", text: "The assistant remembers this chat while it's open." },
];

/** Welcome screen for a new chat. `children` is the composer (and any error banner). */
export default function EmptyState({ onPick, disabled, incognito, children }) {
  const [starters, setStarters] = useState(() => pickStarters());

  if (incognito) {
    return (
      <div className="welcome">
        <div className="incognito-badge" aria-hidden="true">
          <Ghost size={40} strokeWidth={1.6} />
        </div>
        <p className="welcome-hello is-muted">Incognito chat</p>
        <h1 className="welcome-title">Nothing here will be saved.</h1>

        <div className="welcome-composer">{children}</div>

        <div className="prompt-cards">
          {INCOGNITO_FACTS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="prompt-card is-static">
              <Icon size={20} strokeWidth={1.8} className="prompt-card-icon" />
              <strong>{title}</strong>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="welcome">
      <div className="orb orb-lg" aria-hidden="true" />
      <p className="welcome-hello">Hello there</p>
      <h1 className="welcome-title">How can I assist you today?</h1>

      <div className="welcome-composer">{children}</div>

      <div className="prompt-cards">
        {starters.map(({ icon: Icon, title, prompt }) => (
          <button key={title} type="button" className="prompt-card" onClick={() => onPick(prompt)} disabled={disabled}>
            <Icon size={20} strokeWidth={1.8} className="prompt-card-icon" />
            <strong>{title}</strong>
            <span>{prompt}</span>
          </button>
        ))}
      </div>
      <button type="button" className="shuffle-ideas" onClick={() => setStarters((current) => pickStarters(current))}>
        <RefreshCw size={14} /> Show other ideas
      </button>
    </div>
  );
}
