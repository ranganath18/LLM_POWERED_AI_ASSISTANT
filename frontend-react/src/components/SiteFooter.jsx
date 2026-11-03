import { Link } from "react-router-dom";

import Logo from "./Logo.jsx";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <Logo />
          <p>An intent-aware assistant that understands, validates and answers support questions.</p>
        </div>
        <nav className="footer-links" aria-label="Footer">
          <Link to="/">Home</Link>
          <Link to="/#features">Features</Link>
          <Link to="/#how">How it works</Link>
          <Link to="/documentation">Documentation</Link>
          <Link to="/chat">Open app</Link>
        </nav>
      </div>
      <div className="container footer-bottom">
        <span>© 2026 Indigo.ai. All rights reserved.</span>
        <Link to="/documentation">Help &amp; documentation</Link>
      </div>
    </footer>
  );
}
