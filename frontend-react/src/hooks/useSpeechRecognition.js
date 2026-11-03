import { useCallback, useEffect, useRef, useState } from "react";

// Chrome, Edge and Safari support speech recognition (Chrome sends the audio to
// Google's servers to transcribe it). Firefox does not, so the mic is disabled there.
const SpeechRecognition =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined;

const ERROR_TEXT = {
  "not-allowed": "Microphone access is blocked. Allow it in your browser's site settings.",
  "service-not-allowed": "Microphone access is blocked. Allow it in your browser's site settings.",
  "audio-capture": "No microphone was found.",
  "no-speech": "Didn't catch that. Try again.",
  network: "Voice input needs an internet connection.",
};

/**
 * Voice input with the browser's Web Speech API.
 * onTranscript(text) is called with everything heard so far in this session
 * (it updates live while you speak).
 */
export function useSpeechRecognition({ onTranscript }) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const recognitionRef = useRef(null);
  const onTranscriptRef = useRef(onTranscript);
  onTranscriptRef.current = onTranscript;

  const stop = useCallback(() => recognitionRef.current?.stop(), []);

  // Stop immediately and ignore anything still being processed (used when sending).
  const cancel = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    recognition.onresult = null;
    recognition.abort();
  }, []);

  const start = useCallback(() => {
    if (!SpeechRecognition || recognitionRef.current) return;

    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => setListening(true);
    recognition.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i += 1) text += event.results[i][0].transcript;
      onTranscriptRef.current?.(text.trim());
    };
    recognition.onerror = (event) => {
      if (event.error !== "aborted") setError(ERROR_TEXT[event.error] ?? "Voice input stopped unexpectedly.");
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
    };

    setError("");
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setError("Voice input couldn't start. Try again.");
    }
  }, []);

  const toggle = useCallback(() => (recognitionRef.current ? stop() : start()), [start, stop]);

  // Clear the error after a few seconds.
  useEffect(() => {
    if (!error) return undefined;
    const timer = setTimeout(() => setError(""), 5000);
    return () => clearTimeout(timer);
  }, [error]);

  // Release the microphone if the component disappears.
  useEffect(() => () => recognitionRef.current?.abort(), []);

  return { supported: Boolean(SpeechRecognition), listening, error, toggle, stop, cancel };
}
