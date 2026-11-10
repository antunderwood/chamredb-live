import { describe, expect, it } from "vitest";
import { formatHash, parseHash } from "./hash";

// Expected strings are worked by hand from the application/x-www-form-urlencoded rules: letters, digits and
// * - . _ stay; space becomes +; everything else is percent-encoded (( ) : & = # % are encoded).
describe("parseHash", () => {
  it("gives the defaults for no hash", () => {
    expect(parseHash("")).toEqual({ q: "", db: undefined, min: 90, rel: undefined });
    expect(parseHash("#")).toEqual({ q: "", db: undefined, min: 90, rel: undefined });
  });
  it("reads the query, database and minimum identity", () => {
    expect(parseHash("#q=card%3AARO%3A1000&min=80")).toEqual({ q: "card:ARO:1000", db: undefined, min: 80, rel: undefined });
    expect(parseHash("#q=tet(M)&db=card&min=0")).toEqual({ q: "tet(M)", db: "card", min: 0, rel: undefined });
  });
  it("falls back to the defaults for invalid values", () => {
    for (const min of ["abc", "101", "-1", "80.5", ""]) expect(parseHash(`#min=${min}`).min).toBe(90);
    expect(parseHash("#db=zzz").db).toBeUndefined();
    expect(parseHash("#db=CARD").db).toBeUndefined(); // exact database names only
  });
  it("accepts the boundary and leading-zero minimums, and the first of a repeated key", () => {
    expect(parseHash("#min=100").min).toBe(100);
    expect(parseHash("#min=080").min).toBe(80);
    expect(parseHash("#q=first&q=second").q).toBe("first");
  });
  it("trims the query, so a blank query is no query", () => {
    expect(parseHash("#q=+").q).toBe("");
    expect(parseHash("#q=%20%20x%20").q).toBe("x");
  });
  it("does not throw on a malformed percent sequence", () => {
    expect(() => parseHash("#q=%E0%A4%A&min=80")).not.toThrow();
    expect(parseHash("#q=100%25&db=card").q).toBe("100%");
  });
  it("reads the release only when it looks like a release name", () => {
    expect(parseHash("#q=x&rel=graph-2026.11.09").rel).toBe("graph-2026.11.09");
    for (const rel of ["", "a b", "x".repeat(65), "<b>"]) expect(parseHash(`#q=x&rel=${encodeURIComponent(rel)}`).rel).toBeUndefined();
  });
  it("caps the query at 200 characters", () => {
    expect(parseHash(`#q=${"a".repeat(500)}`).q).toHaveLength(200);
  });
});

describe("formatHash", () => {
  it("is empty when everything is the default", () => {
    expect(formatHash({ q: "", db: undefined, min: 90, rel: undefined })).toBe("");
  });
  it("omits defaults and encodes the rest", () => {
    expect(formatHash({ q: "tet(M)", db: "card", min: 80, rel: undefined })).toBe("#q=tet%28M%29&db=card&min=80");
    expect(formatHash({ q: "a b&c=d#e", db: undefined, min: 90, rel: undefined })).toBe("#q=a+b%26c%3Dd%23e");
    expect(formatHash({ q: "", db: "ncbi", min: 0, rel: undefined })).toBe("#db=ncbi&min=0");
  });
  it("records the release only together with a search", () => {
    expect(formatHash({ q: "x", db: undefined, min: 90, rel: "graph-2026.11.09" })).toBe("#q=x&rel=graph-2026.11.09");
    expect(formatHash({ q: "", db: undefined, min: 90, rel: "graph-2026.11.09" })).toBe("");
  });
  it("round-trips awkward text", () => {
    for (const q of ["card:ARO:3000230", "ant(2'')-Ia", "100% id", "é ü", "a+b", "x=y&z", "#hash"]) {
      expect(parseHash(formatHash({ q, db: "card", min: 55, rel: "graph-2026.11.09" }))).toEqual({ q, db: "card", min: 55, rel: "graph-2026.11.09" });
    }
  });
});
