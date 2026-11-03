import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import Landing from "./pages/Landing.jsx";
import Chat from "./pages/Chat.jsx";
import Documentation from "./pages/Documentation.jsx";
import { scrollToSection } from "./lib/scroll.js";

/** New page → start at the top. A link like /#features → glide to that section. */
function ScrollManager() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      // Wait a frame so the page has rendered the section.
      requestAnimationFrame(() => scrollToSection(hash.slice(1)));
    } else {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);

  return null;
}

export default function App() {
  return (
    <>
      <ScrollManager />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/documentation" element={<Documentation />} />
        {/* One route for both a new chat (/chat) and a saved one (/chat/<session id>),
            so the page keeps its state when a new chat gets its id. */}
        <Route path="/chat/:sessionId?" element={<Chat />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
