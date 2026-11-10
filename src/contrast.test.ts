import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrast, PAIRS, readThemes } from "./contrast";

// Independent worked values (WCAG 2.x definition, not produced by this code): black on white is 21:1, white on white
// is 1:1, and #777777 on white is 4.48:1 (the well-known just-failing grey; #767676 is the first grey to pass 4.5).
describe("contrast formula", () => {
  it("matches worked values", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(contrast("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
    expect(contrast("#767676", "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast("#ffffff", "#000000")).toBeCloseTo(21, 5); // order does not matter
  });
});

describe("token file reader", () => {
  it("finds the dark block even with a later at-rule and a last declaration without a semicolon", () => {
    const css = ":root { --a: #111111; }\n@media (prefers-color-scheme: dark) { :root { --a: #eeeeee } }\n@media (prefers-contrast: more) { :root { --a: #000000; } }";
    expect(readThemes(css)).toEqual({ light: { "--a": "#111111" }, dark: { "--a": "#eeeeee" } });
  });
});

const files = readdirSync("public").filter((f) => /^theme(\.[\w-]+)?\.css$/.test(f));
const doc = readFileSync("docs/accessibility.md", "utf8");

describe("shipped token files", () => {
  it("include the default and the BSB example", () => {
    expect(files).toContain("theme.css");
    expect(files).toContain("theme.bsb.css");
  });

  for (const file of files) {
    const { light, dark } = readThemes(readFileSync(`public/${file}`, "utf8"));
    for (const [name, tokens] of [["light", light], ["dark", dark]] as const) {
      describe(`${file} ${name}`, () => {
        it("defines every token the pairs use, as 6-digit hex", () => {
          for (const t of new Set(PAIRS.flatMap(([a, b]) => [a, b]))) expect(tokens[t], t).toMatch(/^#[0-9a-f]{6}$/i);
        });
        for (const [fg, bg, min, why] of PAIRS) {
          it(`${fg} on ${bg} is at least ${min}:1 (${why})`, () => {
            expect(contrast(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(min);
          });
          it(`docs/accessibility.md reports ${fg} on ${bg}`, () => {
            const row = `| ${file} | ${name} | ${fg} on ${bg} | ${contrast(tokens[fg], tokens[bg]).toFixed(2)} |`;
            expect(doc).toContain(row);
          });
        }
      });
    }
  }
});
