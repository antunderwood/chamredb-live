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

// Light tokens: the :root block outside any @media. Dark tokens: the :root block inside @media (prefers-color-scheme: dark).
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
  const root = (s: string) => /:root\s*\{([^}]*)\}/.exec(s)?.[1] ?? "";
  return { light: declarations(root(lightCss)), dark: declarations(root(darkCss)) };
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
];
