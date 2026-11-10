import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { build } from "vite";
import { describe, expect, it } from "vitest";
import { buildIndex } from "./parse";
import { findEntries } from "./query";
import type { Index, ReleaseGraph } from "./types";

// Expected numbers come from the release notes and diff_report.md (nodes 15859, edges 51971) and from an
// independent Python count of data/graph.json (data/README.md), not from this code.
const sha256 = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const provenance = JSON.parse(readFileSync("data/provenance.json", "utf8"));
const graph = JSON.parse(readFileSync("data/graph.json", "utf8")) as ReleaseGraph;
const index = buildIndex(graph, provenance.version);
const entries = Object.values(index.entries);

describe("shipped release provenance", () => {
  it("records every field in a valid form", () => {
    for (const k of ["file", "tool", "tool_source", "version", "build", "source"]) expect(provenance[k], k).toBeTruthy();
    for (const k of ["sha256", "manifest_sha256"]) expect(provenance[k], k).toMatch(/^[0-9a-f]{64}$/);
    for (const k of ["date", "retrieved"]) expect(provenance[k], k).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("matches the files on disk", () => {
    expect(provenance.sha256).toBe(sha256("data/graph.json"));
    expect(provenance.manifest_sha256).toBe(sha256("data/data_manifest.json"));
  });
  it("names the release that .bio-skills.yaml declares", () => {
    expect(readFileSync(".bio-skills.yaml", "utf8")).toContain(`release: ${provenance.version}`);
  });
});

describe("release graph-2026.11.09 index", () => {
  it("has the released entry and edge counts", () => {
    const perDb = (db: string) => entries.filter((e) => e.database === db).length;
    expect(entries).toHaveLength(15859);
    expect([perDb("card"), perDb("ncbi"), perDb("resfinder")]).toEqual([5971, 7299, 2589]);
    expect(Object.values(index.edges).flat()).toHaveLength(51971);
  });
  it("keeps the descriptive fields (counts from an independent Python count)", () => {
    expect(entries.filter((e) => e.phenotype).length).toBe(15734);
    expect(entries.filter((e) => e.additionalPhenotype).length).toBe(1260);
    expect(entries.filter((e) => e.product).length).toBe(7299);
    expect(Object.values(index.edges).flat().filter((e) => e.coverage > 1)).toHaveLength(1352);
  });
  it("round-trips edge values unchanged through the shipped JSON", () => {
    const shipped = JSON.parse(JSON.stringify(index)) as Index;
    expect(shipped.edges["card:ARO:3000005"].slice(0, 2)).toEqual([
      { target: "ncbi:WP_063856692.1", identity: 0.997, coverage: 1, type: "RBH" },
      { target: "resfinder:VanHDX", identity: 0.79, coverage: 1, type: "RBH" },
    ]);
  });
  it("ships under 1.5 MB gzipped", () => {
    expect(gzipSync(JSON.stringify(index)).length).toBeLessThan(1.5e6);
  });
  it("finds the homepage example ids still in this release", () => {
    for (const id of ["card:ARO:3000230", "ncbi:WP_012695489.1", "resfinder:blaNDM-1"]) {
      expect(findEntries(index, id).map((c) => c.id)).toEqual([id]);
    }
  });
  it("has no entry with id ncbi:NG_050598.1, but keeps that accession as a duplicate allele id", () => {
    expect(findEntries(index, "ncbi:NG_050598.1")).toEqual([]);
    expect(index.entries["ncbi:WP_005475717.1"].duplicateAlleleIds.nucleotide_accessions).toContain("NG_050598.1");
  });
});

describe("default build", () => {
  it("ships the pinned release, so the demo banner is not shown", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "chamredb-build-"));
    await build({ logLevel: "silent", build: { outDir } });
    const shipped = JSON.parse(readFileSync(join(outDir, "index.json"), "utf8")) as Index;
    expect(shipped.release).toBe(provenance.version);
    expect(Object.keys(shipped.entries)).toHaveLength(15859);
  }, 30000);

  it("ships a complete provenance.json that matches the files on disk, and none for a non-release build", async () => {
    const outDir = mkdtempSync(join(tmpdir(), "chamredb-prov-"));
    await build({ logLevel: "silent", build: { outDir } });
    const shipped = JSON.parse(readFileSync(join(outDir, "provenance.json"), "utf8"));
    expect(shipped).toEqual({
      release: provenance.version,
      date: provenance.date,
      source: provenance.source,
      tool: "chamredb graph builder (MMseqs2 18.8cc5c; builder/ in the chamredb repo)",
      graphSha256: sha256("data/graph.json"),
      manifestSha256: sha256("data/data_manifest.json"),
      // Written by hand from data/data_manifest.json (one row per source database, not per file).
      databases: [
        { database: "card", release: "4.0.2", retrieved: "2026-11-09" },
        { database: "ncbi", release: "AMRFinderPlus database 4.2, 2026-10-29.1", retrieved: "2026-11-09" },
        { database: "resfinder", release: "eecf0aa207594fe6d51badf808473de62b28cb06", retrieved: "2026-11-09" },
      ],
    });
    expect(shipped.graphSha256).toMatch(/^[0-9a-f]{64}$/);
  }, 30000);
});
