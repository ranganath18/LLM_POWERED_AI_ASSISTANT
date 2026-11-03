import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";

import Logo from "./Logo.jsx";
import ThemeToggle from "./ThemeToggle.jsx";
import { scrollToSection } from "../lib/scroll.js";

const LINKS = [
  { key: "top", label: "Home", to: "/" },
  { key: "features", label: "Features", to: "/#features" },
  { key: "how", label: "How it works", to: "/#how" },
  { key: "docs", label: "Documentation", to: "/documentation" },
];

/** Sticky top bar shared by the home page and the documentation page. */
export default function SiteHeader({ active }) {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [pathname]);

  // Already on the home page? Glide to the section instead of navigating.
  const onLinkClick = (event, link) => {
    setMenuOpen(false);
    if (pathname === "/" && link.key !== "docs") {
      event.preventDefault();
      scrollToSection(link.key);
      window.history.replaceState(null, "", link.key === "top" ? "/" : `/#${link.key}`);
    }
  };

  const links = LINKS.map((link) => (
    <Link
      key={link.key}
      to={link.to}
      className={active === link.key ? "is-active" : undefined}
      aria-current={active === link.key ? "page" : undefined}
      onClick={(event) => onLinkClick(event, link)}
    >
      {link.label}
    </Link>
  ));

  return (
    <header className={`site-nav ${menuOpen ? "is-open" : ""}`}>
      <div className="container nav-inner">
        <Logo />
        <nav className="nav-links" aria-label="Main">
          {links}
        </nav>
        <div className="nav-actions">
          <ThemeToggle />
          <Link to="/chat" className="btn btn-primary btn-sm">
            Get Started
          </Link>
          <button
            type="button"
            className="icon-btn nav-menu-btn"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {menuOpen && (
        <nav className="nav-mobile container" aria-label="Main (mobile)">
          {links}
        </nav>
      )}
    </header>
  );
}
