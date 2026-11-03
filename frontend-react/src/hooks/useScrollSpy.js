import { useEffect, useState } from "react";

/** Returns the id of the section currently in the middle of the screen. */
export function useScrollSpy(ids, fallback = ids[0]) {
  const [active, setActive] = useState(fallback);

  useEffect(() => {
    const elements = ids.map((id) => document.getElementById(id)).filter(Boolean);
    if (elements.length === 0) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length) setActive(visible[0].target.id);
      },
      // A thin band across the middle of the viewport decides which section is "current".
      { rootMargin: "-40% 0px -55% 0px" },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [ids.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  return active;
}
