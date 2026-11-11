import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PhenotypeList } from "./PhenotypeList";

// Server rendering (no DOM needed): the markup the component produces for hand-worked texts.
const html = (text: string) => renderToStaticMarkup(createElement(PhenotypeList, { text }));

describe("PhenotypeList markup (hand-worked)", () => {
  it("label bar without the trailing colon, one bullet per item", () => {
    const h = html("confers resistance to antibiotic: dalfopristin,virginiamycin M1");
    expect(h).toContain(">confers resistance to antibiotic</p>");
    expect([...h.matchAll(/<li [^>]*>([^<]*)<\/li>/g)].map((m) => m[1])).toEqual(["dalfopristin", "virginiamycin M1"]);
  });
  it("NCBI subclass is one bullet, ResFinder splits on comma and space", () => {
    expect(html("confers resistance to subclass A/B").match(/<li /g)).toHaveLength(1);
    expect(html("confers resistance to Vancomycin, Teicoplanin").match(/<li /g)).toHaveLength(2);
  });
  it("unknown shape and 'not recorded' are one verbatim paragraph, no list", () => {
    expect(html("not recorded")).toBe('<p class="break-words" data-phenotype-list="verbatim">not recorded</p>');
    expect(html("")).not.toContain("<ul");
  });
  it("the list is named by its label and the markup carries no literal colour", () => {
    const h = html("confers resistance to subclass A/B");
    expect(h).toMatch(/<p id="([^"]+)"[^>]*>confers resistance to subclass<\/p><ul aria-labelledby="\1"/);
    expect(h).not.toMatch(/style=|#[0-9a-f]{3,8}\b/i);
  });
  it("items are escaped text, never HTML", () => {
    const h = html("confers resistance to X, <img src=x onerror=alert(1)>");
    expect(h).not.toContain("<img");
    expect(h).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });
});
