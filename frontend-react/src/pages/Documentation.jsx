import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  Archive,
  Download,
  Ghost,
  History,
  Mic,
  Moon,
  MousePointerClick,
  ShieldCheck,
  Sparkles,
  Tags,
  Zap,
} from "lucide-react";

import SiteFooter from "../components/SiteFooter.jsx";
import SiteHeader from "../components/SiteHeader.jsx";
import { useScrollSpy } from "../hooks/useScrollSpy.js";
import { scrollToSection } from "../lib/scroll.js";

const TOC = [
  { id: "overview", label: "Overview" },
  { id: "getting-started", label: "Getting started" },
  { id: "features", label: "Features" },
  { id: "how-it-works", label: "How it works" },
  { id: "privacy", label: "Privacy & data" },
  { id: "shortcuts", label: "Keyboard shortcuts" },
  { id: "faq", label: "FAQ" },
];

const FEATURES = [
  { icon: Zap, title: "Live replies", text: "Answers appear word by word. Press Stop (■) to end a reply early." },
  { icon: Tags, title: "Intent detection", text: "Every message is classified (payment, order, greeting…) before it's answered." },
  { icon: BarChart3, title: "Message insights", text: "See the intent, risk, priority and token usage of the latest reply." },
  { icon: History, title: "Chat history", text: "Chats are saved automatically. Search them (Ctrl/⌘ + K) and rename, archive or delete them from the sidebar." },
  { icon: Archive, title: "Archive & restore", text: "Archived or deleted chats wait in Archived chats for 30 days, so you can restore them. After that they are removed for good." },
  { icon: Ghost, title: "Incognito", text: "A full-screen chat that is never saved. It disappears when you leave." },
  { icon: Mic, title: "Voice input", text: "Click the mic and speak; your words appear in the message box." },
  { icon: Download, title: "Export & share", text: "Download a chat as a Markdown file, or copy a link to it." },
  { icon: Moon, title: "Light & dark", text: "Switch themes from the sidebar or the top bar. Your choice is remembered." },
];

const STEPS = [
  { title: "Understand", text: "The AI reads your message and picks its intent, risk and priority." },
  { title: "Check", text: "That result is checked against strict rules, so mistakes are caught before you see them." },
  { title: "Answer", text: "A second AI call writes the reply, using the check result and your recent messages." },
  { title: "Save", text: "The finished chat is stored so you can return to it (except in incognito)." },
];

const SHORTCUTS = [
  { keys: ["Enter"], action: "Send message" },
  { keys: ["Shift", "Enter"], action: "New line" },
  { keys: ["Ctrl / ⌘", "K"], action: "Search chats" },
  { keys: ["Esc"], action: "Close a panel or menu · stop voice input" },
  { keys: ["Double-click"], action: "Rename a chat in the sidebar" },
];

const FAQ = [
  {
    q: "Is my chat saved?",
    a: "Yes, normal chats are saved in the app's database so they appear in your sidebar. Incognito chats are never saved.",
  },
  {
    q: "I deleted a chat by mistake. Can I get it back?",
    a: "Yes, within 30 days. Open “Archived chats” at the bottom of the sidebar and click Restore. You can also click Undo right after deleting.",
  },
  {
    q: "Does Indigo.ai remember earlier messages?",
    a: "Yes, it uses the last 12 messages of the current chat, so follow-up questions like “what about the second one?” work.",
  },
  {
    q: "Can it check my real order or payment?",
    a: "No. It explains what to do and classifies your request, but it isn't connected to any order or payment system.",
  },
  {
    q: "Why didn't my stopped reply show up after a refresh?",
    a: "Replies are saved only once they finish. A stopped or interrupted reply is not stored.",
  },
  {
    q: "The mic button is greyed out.",
    a: "Your browser doesn't support voice input. Use Chrome, Edge or Safari, and allow microphone access when asked.",
  },
  {
    q: "What are input and output tokens?",
    a: "Tokens are small pieces of text the AI reads (input) and writes (output). Each reply shows both, counted across its two AI calls.",
  },
];

export default function Documentation() {
  const active = useScrollSpy(TOC.map((item) => item.id));

  const jump = (event, id) => {
    event.preventDefault();
    scrollToSection(id);
    window.history.replaceState(null, "", `#${id}`);
  };

  return (
    <div className="landing docs-page">
      <SiteHeader active="docs" />

      <header className="docs-hero container">
        <span className="pill">
          <Sparkles size={14} /> Documentation
        </span>
        <h1>
          Everything you need to <span className="grad-text">use Indigo.ai</span>
        </h1>
        <p>A short guide to what the app does, how to use it, and what happens to your data.</p>
      </header>

      <div className="container docs-layout">
        <nav className="docs-toc" aria-label="On this page">
          <p className="docs-toc-title">On this page</p>
          {TOC.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={active === item.id ? "is-active" : undefined}
              onClick={(event) => jump(event, item.id)}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <main className="docs-content">
          <section id="overview" className="docs-section">
            <h2>Overview</h2>
            <p>
              Indigo.ai is an AI assistant for customer-support questions. You ask a question in plain language: about a
              payment, an order, your account or anything else. It answers clearly, step by step.
            </p>
            <p>
              What makes it different: before answering, it first <strong>understands</strong> your
              message (what you want, how urgent it is) and <strong>checks</strong> that understanding
              against strict rules. Only then does it write the reply.
            </p>
          </section>

          <section id="getting-started" className="docs-section">
            <h2>Getting started</h2>
            <ol className="docs-steps">
              <li>
                <strong>Open the app.</strong> Click <Link to="/chat">Get Started</Link>.
              </li>
              <li>
                <strong>Ask anything.</strong> Type your question, click a suggested card, or use the mic.
              </li>
              <li>
                <strong>Keep talking.</strong> Ask follow-up questions; the assistant remembers the chat.
              </li>
              <li>
                <strong>Come back later.</strong> Your chats are listed in the sidebar, grouped by date.
              </li>
            </ol>
            <Link to="/chat" className="btn btn-primary">
              Open the app <ArrowRight size={16} />
            </Link>
          </section>

          <section id="features" className="docs-section">
            <h2>Features</h2>
            <div className="docs-features">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <div key={title} className="docs-feature">
                  <span className="docs-feature-icon">
                    <Icon size={18} />
                  </span>
                  <div>
                    <strong>{title}</strong>
                    <p>{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section id="how-it-works" className="docs-section">
            <h2>How it works</h2>
            <p>Every message goes through four steps:</p>
            <ol className="docs-flow">
              {STEPS.map((step, index) => (
                <li key={step.title}>
                  <span className="docs-flow-num">{index + 1}</span>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="docs-note">
              <MousePointerClick size={15} /> Click the chart icon in the chat to see what step 1 found for your last
              message.
            </p>
          </section>

          <section id="privacy" className="docs-section">
            <h2>Privacy & data</h2>
            <div className="docs-table">
              <div>
                <span>Normal chat</span>
                <span>Saved in the app's database (title and messages) so it appears in your history.</span>
              </div>
              <div>
                <span>Incognito chat</span>
                <span>Never saved. It exists only in your open browser tab.</span>
              </div>
              <div>
                <span>AI processing</span>
                <span>Your message is sent to our AI provider to generate the reply, in both modes.</span>
              </div>
              <div>
                <span>Voice input</span>
                <span>Your browser turns speech into text (in Chrome, this uses Google's speech service).</span>
              </div>
              <div>
                <span>Deleting</span>
                <span>Deleting or archiving a chat moves it to Archived chats. It is removed permanently after 30 days, or straight away if you choose “Delete forever” there.</span>
              </div>
            </div>
            <p className="docs-note docs-note-warn">
              <ShieldCheck size={15} /> There are no personal accounts yet, so saved chats are visible to anyone using this
              app. Use incognito for anything private, and never share passwords, OTPs or full card numbers. The
              assistant will never ask for them.
            </p>
          </section>

          <section id="shortcuts" className="docs-section">
            <h2>Keyboard shortcuts</h2>
            <div className="docs-table docs-shortcuts">
              {SHORTCUTS.map((item) => (
                <div key={item.action}>
                  <span>
                    {item.keys.map((key) => (
                      <kbd key={key}>{key}</kbd>
                    ))}
                  </span>
                  <span>{item.action}</span>
                </div>
              ))}
            </div>
          </section>

          <section id="faq" className="docs-section">
            <h2>FAQ</h2>
            <div className="docs-faq">
              {FAQ.map((item) => (
                <details key={item.q}>
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </section>

          <div className="docs-end">
            <Sparkles size={18} />
            <span>Ready to try it? Your first chat takes a few seconds.</span>
            <Link to="/chat" className="btn btn-primary btn-sm">
              Open the app
            </Link>
          </div>
        </main>
      </div>

      <SiteFooter />
    </div>
  );
}
