import { useEffect, useRef, useState } from "react";
import { ArrowUp, History, Keyboard, Mic, MicOff, Sparkles, Square } from "lucide-react";

import { useSpeechRecognition } from "../hooks/useSpeechRecognition.js";

const MAX_LENGTH = 5000; // Same limit as IngestionRequest in the backend.

const joinText = (before, spoken) => (before && spoken ? `${before.replace(/\s+$/, "")} ${spoken}` : before || spoken);

/**
 * Message box. variant="hero" is the big welcome-screen version with a hint strip;
 * variant="dock" is the compact version pinned under the conversation.
 * While `busy` (AI replying), the send button becomes a Stop button that calls onStop.
 */
export default function Composer({
  onSend,
  onStop,
  busy = false,
  variant = "dock",
  placeholder = "Ask me anything…",
  footerNote = "Remembers this chat",
}) {
  const [text, setText] = useState("");
  const textareaRef = useRef(null);
  const textBeforeVoiceRef = useRef("");

  const voice = useSpeechRecognition({
    onTranscript: (spoken) => setText(joinText(textBeforeVoiceRef.current, spoken).slice(0, MAX_LENGTH)),
  });

  // Grow the textarea with its content, up to the CSS max-height.
  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [text]);

  useEffect(() => {
    if (!busy) textareaRef.current?.focus();
  }, [busy]);

  const toggleVoice = () => {
    if (!voice.listening) textBeforeVoiceRef.current = text;
    voice.toggle();
  };

  const submit = () => {
    if (!text.trim() || busy) return;
    voice.cancel(); // stop listening so late results don't refill the box
    onSend(text);
    setText("");
  };

  const onKeyDown = (event) => {
    if (event.key === "Escape" && voice.listening) {
      event.stopPropagation();
      voice.stop();
    } else if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  const onChange = (event) => {
    if (voice.listening) voice.stop(); // typing takes over from dictation
    setText(event.target.value);
  };

  const micTitle = !voice.supported
    ? "Voice input isn't supported in this browser (try Chrome or Edge)"
    : voice.listening
      ? "Stop voice input"
      : "Start voice input";

  return (
    <form
      className={`composer composer-${variant}`}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className={`composer-box ${voice.listening ? "is-listening" : ""}`}>
        <textarea
          ref={textareaRef}
          rows={variant === "hero" ? 3 : 1}
          value={text}
          maxLength={MAX_LENGTH}
          placeholder={voice.listening ? "Listening… speak now" : placeholder}
          onChange={onChange}
          onKeyDown={onKeyDown}
          aria-label="Message"
        />
        <div className="composer-bar">
          {voice.listening ? (
            <span className="listening-pill" role="status">
              <span className="voice-bars" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </span>
              Listening… click the mic to stop
            </span>
          ) : voice.error ? (
            <span className="voice-error" role="status">
              <MicOff size={14} /> {voice.error}
            </span>
          ) : (
            <span className="composer-pill" title="Every message is classified before it's answered">
              <Sparkles size={14} /> Intent detection
            </span>
          )}

          <div className="composer-right">
            {text.length > MAX_LENGTH - 500 && (
              <span className="composer-count">
                {text.length}/{MAX_LENGTH}
              </span>
            )}
            <button
              type="button"
              className={`mic-btn ${voice.listening ? "is-on" : ""}`}
              onClick={toggleVoice}
              disabled={!voice.supported}
              aria-pressed={voice.listening}
              aria-label={micTitle}
              title={micTitle}
            >
              {voice.listening ? <Square size={14} fill="currentColor" /> : <Mic size={18} />}
            </button>
            {busy ? (
              <button type="button" className="send-orb is-stop" onClick={onStop} aria-label="Stop the reply" title="Stop">
                <Square size={14} fill="currentColor" />
              </button>
            ) : (
              <button type="submit" className="send-orb" disabled={!text.trim()} aria-label="Send message" title="Send">
                <ArrowUp size={18} strokeWidth={2.4} />
              </button>
            )}
          </div>
        </div>
      </div>

      {variant === "hero" && (
        <div className="composer-strip">
          <span>
            <Keyboard size={15} /> <kbd>Enter</kbd> to send · <kbd>Shift + Enter</kbd> for a new line
          </span>
          <span className="composer-strip-right">
            <History size={14} /> {footerNote}
          </span>
        </div>
      )}
    </form>
  );
}
