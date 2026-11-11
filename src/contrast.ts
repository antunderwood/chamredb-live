// WCAG 2.x contrast, and a reader for the token files in public/. Used by tests only; not bundled into the app.

const channel = (v: number) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

export function luminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`not a 6-digit hex colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export type Tokens = Record<string, string>;

function declarations(block: string): Tokens {
  const out: Tokens = {};
  for (const m of block.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) out[m[1]] = m[2].trim();
  return out;
}

// Light tokens: the :root block outside any @media. Dark tokens: the :root block inside @media (prefers-color-scheme: dark),
// which may be written :root:not([data-theme="light"]) so an explicit light choice beats the system setting.
export function readThemes(css: string): { light: Tokens; dark: Tokens } {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const open = /@media\s*\(prefers-color-scheme:\s*dark\)\s*\{/.exec(stripped);
  if (!open) throw new Error("no @media (prefers-color-scheme: dark) block");
  let depth = 1;
  let end = open.index + open[0].length;
  for (; end < stripped.length && depth > 0; end++) depth += stripped[end] === "{" ? 1 : stripped[end] === "}" ? -1 : 0;
  if (depth > 0) throw new Error("unbalanced braces in the dark @media block");
  const darkCss = stripped.slice(open.index + open[0].length, end - 1);
  const lightCss = stripped.slice(0, open.index) + stripped.slice(end); // anything outside the dark block
  const root = (s: string) => /:root(?::not\(\[data-theme="light"\]\))?\s*\{([^}]*)\}/.exec(s)?.[1] ?? "";
  return { light: declarations(root(lightCss)), dark: declarations(root(darkCss)) };
}

// Dark tokens chosen by the toggle: the :root[data-theme="dark"] block. It must equal the media block (same values twice).
export function readDarkAttribute(css: string): Tokens {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return declarations(/:root\[data-theme="dark"\]\s*\{([^}]*)\}/.exec(stripped)?.[1] ?? "");
}

// [foreground token, background token, minimum ratio, why]: text is 4.5, marks, focus indicators and control boundaries 3.
export const PAIRS: [string, string, number, string][] = [
  ["--fg", "--bg", 4.5, "text"],
  ["--fg", "--surface", 4.5, "text"],
  ["--muted", "--bg", 4.5, "text"],
  ["--muted", "--surface", 4.5, "text"],
  ["--danger", "--bg", 4.5, "text"],
  ["--danger", "--surface", 4.5, "text"],
  ["--accent-fg", "--accent", 4.5, "text"],
  ["--accent", "--bg", 3, "mark and focus indicator"],
  ["--accent", "--surface", 3, "mark and focus indicator"],
  ["--control-border", "--bg", 3, "control boundary"],
  ["--control-border", "--surface", 3, "control boundary"],
  ["--fg", "--panel", 4.5, "text"],
  ["--muted", "--panel", 4.5, "text"],
  ["--danger", "--panel", 4.5, "text"],
  ["--accent", "--panel", 3, "mark and focus indicator"],
  ["--brand-fg", "--brand", 4.5, "header text, header focus ring and toggle outline"],
  ["--nav-active-fg", "--nav-active-bg", 4.5, "text"],
  ["--nav-active-bg", "--brand", 3, "mark"],
  ["--chip-fg", "--chip-query", 4.5, "text"],
  ["--chip-fg", "--chip-db", 4.5, "text"],
  ["--chip-fg", "--chip-name", 4.5, "text"],
  ["--chip-fg", "--chip-match", 4.5, "text"],
  ["--chip-query", "--surface", 3, "mark"],
  ["--chip-db", "--surface", 3, "mark"],
  ["--chip-name", "--surface", 3, "mark"],
  ["--chip-match", "--surface", 3, "mark"],
  ["--label-fg", "--label", 4.5, "text"],
  ["--label", "--surface", 3, "mark"],
  ["--chip-query", "--panel", 3, "mark"],
  ["--chip-db", "--panel", 3, "mark"],
  ["--chip-name", "--panel", 3, "mark"],
  ["--chip-match", "--panel", 3, "mark"],
  // Network picture (ticket #9): database badges and chip outlines, the Best ribbon and the soft edges.
  ["--db-card-fg", "--db-card", 4.5, "text"],
  ["--db-ncbi-fg", "--db-ncbi", 4.5, "text"],
  ["--db-resfinder-fg", "--db-resfinder", 4.5, "text"],
  ["--db-card", "--surface", 3, "mark"],
  ["--db-ncbi", "--surface", 3, "mark"],
  ["--db-resfinder", "--surface", 3, "mark"],
  ["--db-card", "--panel", 3, "mark"],
  ["--db-ncbi", "--panel", 3, "mark"],
  ["--db-resfinder", "--panel", 3, "mark"],
  ["--best-fg", "--best", 4.5, "text"],
  ["--best", "--surface", 3, "mark"],
  ["--best", "--panel", 3, "mark"],
  ["--control-border", "--panel", 3, "mark (step-2 edges and chip outlines)"],
  ["--label", "--panel", 3, "bar fill on its track (comparison strip and Match details cards)"],
];
