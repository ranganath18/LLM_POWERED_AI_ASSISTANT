import { useEffect, useState } from "react";
import { api } from "../lib/api.js";

const CHECK_EVERY_MS = 15000;

/**
 * Polls GET /health.
 * Returns { status: "checking" | "online" | "offline", model: string | null }.
 */
export function useBackendStatus() {
  const [state, setState] = useState({ status: "checking", model: null });

  useEffect(() => {
    let active = true;

    const check = () =>
      api
        .health()
        .then((health) => active && setState({ status: "online", model: health.model ?? null }))
        .catch(() => active && setState((current) => ({ ...current, status: "offline" })));

    check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return state;
}
