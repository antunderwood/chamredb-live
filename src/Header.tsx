import { useEffect, useLayoutEffect, useState } from "react";

// Site header: wordmark, nav (Query, About, Code) and the light/dark toggle.
// Theme: with no saved choice the system setting applies (public/theme.css media query). A saved choice sets
// data-theme on <html>, which the same file honours. localStorage is a per-viewer convenience: every access is in
// try/catch, so with storage blocked the toggle still works for the visit and the choice is simply not kept.
const KEY = "chamredb-theme";
const CODE_URL = "https://github.com/antunderwood/chamredb-live";
type Choice = "light" | "dark";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function savedChoice(): Choice | null {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

function save(choice: Choice) {
  try {
    window.localStorage.setItem(KEY, choice);
  } catch {
    // storage blocked or full: the choice lasts for this visit only
  }
}

export function Header() {
  const [choice, setChoice] = useState<Choice | null>(savedChoice);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia(DARK_QUERY).matches);
  const dark = choice ? choice === "dark" : systemDark;

  useEffect(() => {
    const mq = window.matchMedia(DARK_QUERY);
    const update = () => setSystemDark(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Before React's first paint, not before the bundle loads: a saved choice that differs from the system setting can
  // show the system theme briefly (an inline script would avoid that, but the CSP forbids inline scripts).
  useLayoutEffect(() => {
    if (choice) document.documentElement.dataset.theme = choice;
    else delete document.documentElement.dataset.theme;
  }, [choice]);

  const toggle = () => {
    const next: Choice = dark ? "light" : "dark";
    setChoice(next);
    save(next);
  };

  const goToQuery = () => document.getElementById("entry-query")?.focus();
  const goToAbout = () => {
    const about = document.querySelector<HTMLDetailsElement>('[data-testid="about"]');
    if (!about) return;
    about.open = true;
    about.scrollIntoView({ block: "start" });
    about.querySelector("summary")?.focus();
  };

  return (
    <header className="site-header bg-brand text-brand-fg">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3">
        <p className="wordmark text-3xl font-bold tracking-tight">
          <span aria-hidden="true">chAMR😍Db</span>
          <span className="sr-only">chAMReDB</span>
        </p>
        <nav aria-label="Main" className="order-3 w-full sm:order-none sm:ml-4 sm:w-auto">
          <ul className="flex gap-1">
            <li>
              <button type="button" onClick={goToQuery} className="nav-item nav-item-active">Query</button>
            </li>
            <li>
              <button type="button" onClick={goToAbout} className="nav-item">About</button>
            </li>
            <li>
              <a href={CODE_URL} className="nav-item">Code</a>
            </li>
          </ul>
        </nav>
        <button
          type="button"
          onClick={toggle}
          aria-pressed={dark}
          aria-label="Dark mode"
          className="theme-toggle ml-auto"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false" strokeWidth={2} strokeLinejoin="round">
            <path d="M20 14.5A8 8 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" style={{ fill: dark ? "currentColor" : "none", stroke: "currentColor" }} />
          </svg>
        </button>
      </div>
    </header>
  );
}
