import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Tokens only: components and app.css name colours through var(--token) or Tailwind token classes, never literally.
const sources = [...readdirSync("src").filter((f) => f.endsWith(".tsx")).map((f) => `src/${f}`), "src/app.css"];
const NAMED = "white|black|red|green|blue|yellow|orange|purple|pink|gray|grey|cyan|magenta|teal|navy|maroon|olive|lime|aqua|silver|gold|brown|coral|crimson|indigo|violet|slate|zinc|neutral|stone|amber|emerald|sky|rose|fuchsia";
const LITERAL: [string, RegExp][] = [
  ["hex colour", /(?<![\w&])#[0-9a-fA-F]{3,8}\b/],
  ["rgb/hsl/oklch/lab/color()", /\b(rgba?|hsla?|oklch|oklab|lab|lch|hwb|color)\(/],
  ["named colour in a colour property", new RegExp(`\\b(fill|stroke|color|background(-color)?|border-color|stopColor|backgroundColor|borderColor)\\s*[:=]\\s*\\{?\\s*["'\`]?(${NAMED}|transparent)\\b`, "i")],
  ["Tailwind palette class", new RegExp(`\\b(bg|text|border|fill|stroke|ring|accent|outline|from|to|via|divide|decoration|shadow)-(${NAMED})(-\\d{2,3})?\\b`)],
];
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ .*$/gm, "");

describe("no literal colours in components or app.css", () => {
  for (const f of sources) {
    it(f, () => {
      const text = strip(readFileSync(f, "utf8"));
      for (const [what, re] of LITERAL) expect(re.exec(text)?.[0], `${f}: ${what}`).toBeUndefined();
    });
  }
  it("the detector fires on literals (negative control)", () => {
    for (const bad of ['style={{ fill: "#0072b2" }}', "color: rgb(0 0 0)", 'stroke="red"', "bg-white", "text-blue-700"]) {
      expect(LITERAL.some(([, re]) => re.test(bad)), bad).toBe(true);
    }
    for (const ok of ['style={{ fill: "var(--accent)" }}', "bg-accent text-accent-fg", "url(#nv-arrow)"]) {
      expect(LITERAL.some(([, re]) => re.test(ok)), ok).toBe(false);
    }
  });
});
