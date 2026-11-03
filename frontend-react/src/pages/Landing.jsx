import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Copy,
  Database,
  Gauge,
  History,
  Lightbulb,
  MessageSquare,
  MessagesSquare,
  ShieldCheck,
  Sparkles,
  Tags,
  User,
} from "lucide-react";

import SiteFooter from "../components/SiteFooter.jsx";
import SiteHeader from "../components/SiteHeader.jsx";
import { useScrollSpy } from "../hooks/useScrollSpy.js";
import { scrollToSection } from "../lib/scroll.js";

function HeroPreview() {
  return (
    <div className="preview-window">
      <div className="preview-chrome">
        <span className="chrome-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="preview-model">
          <span className="status-dot status-online" /> Indigo.ai
        </span>
        <span className="preview-label">Workspace: Customer support</span>
      </div>

      <div className="preview-body">
        <div className="preview-user">
          <span className="preview-user-bubble">My payment was deducted twice. What should I do?</span>
          <span className="avatar avatar-user">
            <User size={14} />
          </span>
        </div>

        <div className="preview-assistant">
          <span className="avatar avatar-ai">
            <Sparkles size={14} />
          </span>
          <div className="preview-card">
            <div className="preview-card-head">
              <strong>Indigo.ai</strong>
              <span className="intent-badge">Payment issue</span>
              <span className="msg-time">just now</span>
            </div>
            <p>
              Sorry about the double charge. First, check whether the second payment is still
              <em> pending</em>: these often drop off within a few days. If it has settled, contact
              support with both transaction IDs so they can refund it.
            </p>

            <div className="flow-box">
              <span className="flow-title">
                <Lightbulb size={14} /> How this reply was made
              </span>
              <div className="flow-steps">
                <div>
                  <small>01. Classify</small>
                  <span>Payment issue · high priority</span>
                </div>
                <div>
                  <small>02. Validate</small>
                  <span>Checked against strict rules</span>
                </div>
                <div>
                  <small>03. Respond</small>
                  <span>Clear answer with context</span>
                </div>
              </div>
            </div>

            <div className="preview-actions">
              <span className="ghost-btn">
                <Copy size={13} /> Copy
              </span>
              <span className="mono-note">~12 input tokens</span>
            </div>
          </div>
        </div>
      </div>

      <Link to="/chat" className="preview-input">
        <span>Ask a follow-up question…</span>
        <span className="send-btn send-btn-sm" aria-hidden="true">
          <ArrowUp size={16} />
        </span>
      </Link>
    </div>
  );
}

const FEATURES = [
  {
    icon: MessagesSquare,
    tone: "indigo",
    title: "Smart Conversations",
    text: "Every message is classified first, so the answer matches what you actually need, whether that's a refund, an order or a quick question.",
    visual: (
      <div className="mini-card">
        <div className="mini-row">
          <span className="mini-label">“Where is my order?”</span>
        </div>
        <div className="mini-chips">
          <span className="intent-badge">Order tracking</span>
          <span className="level-chip level-medium">medium</span>
        </div>
      </div>
    ),
  },
  {
    icon: History,
    tone: "violet",
    title: "Organized Chat History",
    text: "Conversations are saved automatically. Come back to any chat from the sidebar and the assistant still remembers the context.",
    visual: (
      <div className="mini-card mini-list">
        <div className="mini-row">
          <MessageSquare size={14} /> <span>Where is my order?</span> <small>2m</small>
        </div>
        <div className="mini-row">
          <History size={14} /> <span>Refund policy question</span> <small>Yesterday</small>
        </div>
      </div>
    ),
  },
  {
    icon: Gauge,
    tone: "green",
    title: "Clear Insights",
    text: "See how each message was understood: intent, risk, priority and token usage, all checked against strict rules.",
    visual: (
      <div className="mini-card">
        <div className="mini-meter">
          <span>Risk</span>
          <span className="meter">
            <i style={{ width: "80%" }} className="meter-danger" />
          </span>
        </div>
        <div className="mini-meter">
          <span>Priority</span>
          <span className="meter">
            <i style={{ width: "55%" }} className="meter-warning" />
          </span>
        </div>
      </div>
    ),
  },
];

const PIPELINE = [
  { title: "Your message", detail: "Ask in plain words" },
  { title: "Understand", detail: "Intent, risk and priority detected" },
  { title: "Check", detail: "Strict rules catch mistakes" },
  { title: "Answer", detail: "A clear reply using your recent messages" },
  { title: "Save", detail: "Kept in your chat history" },
];

const SECTIONS = ["top", "features", "how"];

export default function Landing() {
  const active = useScrollSpy(SECTIONS);

  return (
    <div className="landing">
      <SiteHeader active={active} />

      <main>
        <section id="top" className="hero container">
          <div className="orb orb-lg hero-orb" aria-hidden="true" />
          <span className="pill">
            <Sparkles size={14} /> Your intent-aware AI assistant
          </span>
          <h1 className="hero-brand">
            Indigo<span className="hero-brand-ai">.ai</span>
          </h1>
          <p className="hero-tagline">
            Ask Anything. <span className="grad-text">Get Clear Answers.</span>
          </p>
          <p className="hero-sub">
            <strong>Indigo.ai</strong> is your personal AI workspace for everyday support questions. Every
            message is understood, checked and answered in simple, organized conversations.
          </p>
          <div className="hero-actions">
            <Link to="/chat" className="btn btn-primary">
              Get Started <ArrowRight size={16} />
            </Link>
            <Link to="/documentation" className="btn btn-outline">
              <BookOpen size={16} /> Documentation
            </Link>
          </div>
          <button type="button" className="explore-link" onClick={() => scrollToSection("features")}>
            Explore features <ChevronDown size={15} />
          </button>
          <ul className="trust-row">
            <li>
              <ShieldCheck size={15} /> Validated output
            </li>
            <li>
              <Tags size={15} /> Intent detection
            </li>
            <li>
              <Database size={15} /> Session memory
            </li>
          </ul>

          <HeroPreview />
        </section>

        <section id="features" className="section container">
          <span className="eyebrow-pill">Why Indigo.ai</span>
          <h2>Designed for focus and clarity</h2>
          <p className="section-sub">
            No noise, just the pieces you need: understand the question, answer it well, and keep
            the conversation organized.
          </p>
          <div className="feature-grid">
            {FEATURES.map(({ icon: Icon, tone, title, text, visual }) => (
              <article key={title} className="feature-card">
                <span className={`tile-icon tone-${tone}`}>
                  <Icon size={20} />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
                {visual}
              </article>
            ))}
          </div>
        </section>

        <section id="how" className="container">
          <div className="how-band">
            <div className="how-text">
              <span className="eyebrow">Under the hood</span>
              <h3>Every reply starts with understanding.</h3>
              <p>
                Before answering, Indigo.ai classifies your message into a fixed set of intents
                and checks the result against strict rules. Only checked information is used to write
                the reply.
              </p>
              <div className="stats">
                <div>
                  <strong>6</strong>
                  <span>Intent categories</span>
                </div>
                <div>
                  <strong>12</strong>
                  <span>Messages of memory</span>
                </div>
                <div>
                  <strong>2</strong>
                  <span>AI steps per reply</span>
                </div>
              </div>
            </div>

            <ol className="pipeline">
              {PIPELINE.map((step, index) => (
                <li key={step.title}>
                  <span className="pipeline-step">{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <strong>{step.title}</strong>
                    <span>{step.detail}</span>
                  </div>
                  {index === 2 && <CheckCircle2 size={16} className="text-success pipeline-check" />}
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="container">
          <div className="cta-card">
            <span className="cta-icon">
              <MessagesSquare size={22} />
            </span>
            <h2>
              Ready to talk to <span className="grad-text">Indigo.ai</span>?
            </h2>
            <p>Get answers, explore ideas, and keep every conversation organized in one place.</p>
            <div className="hero-actions">
              <Link to="/chat" className="btn btn-primary">
                Get Started <ArrowRight size={16} />
              </Link>
              <Link to="/documentation" className="btn btn-soft">
                <BookOpen size={16} /> Read Documentation
              </Link>
            </div>
            <small>Chats are saved so you can pick up where you left off · Use incognito for private chats</small>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
