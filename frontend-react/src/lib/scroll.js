const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Smoothly scroll to a section by id ("top" = top of the page). */
export function scrollToSection(id) {
  const behavior = prefersReducedMotion() ? "auto" : "smooth";
  if (!id || id === "top") {
    window.scrollTo({ top: 0, behavior });
    return;
  }
  // CSS `scroll-margin-top` on sections keeps them clear of the sticky header.
  document.getElementById(id)?.scrollIntoView({ behavior, block: "start" });
}
