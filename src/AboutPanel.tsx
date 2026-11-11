import { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { DB_LABEL, type Provenance } from "./provenance";

// The About and data panel (#21, ADR 0006): one native modal <dialog> drawn as a side sheet, opened from the header's
// About and the footer's About and "Sources and checksums". The browser gives Esc to close, the inert page behind
// and focus back on the opener; there is no focus-trap library. Opening it does not touch the URL hash (the search).
// It holds the 2021 About text and the full provenance, unchanged from the old footer, with copy buttons for the two
// checksums. The links are plain outbound links the reader clicks; nothing is requested from them when the page loads.
const DATABASE_LINKS = [
  ["The Comprehensive Antibiotic Resistance Database (CARD)", "https://card.mcmaster.ca/"],
  ["NCBI AMRFinderPlus Database", "https://www.ncbi.nlm.nih.gov/pathogens/antimicrobial-resistance/AMRFinder/"],
  ["The ResFinder Database", "https://bitbucket.org/genomicepidemiology/resfinder_db/src/master/"],
] as const;

export interface AboutPanelHandle {
  open: (section: "about" | "data") => void;
}

function Checksum({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState<"yes" | "no" | null>(null);
  const copy = () =>
    navigator.clipboard
      .writeText(value)
      .then(() => setCopied("yes"))
      .catch(() => setCopied("no"));
  return (
    <div className="mt-2">
      <p>{label}</p>
      <div className="mt-1 flex items-start gap-2">
        <code className="min-w-0 flex-1 break-all rounded bg-panel px-2 py-1 text-xs" data-sha>{value}</code>
        <button type="button" onClick={copy} className="shrink-0 rounded-md border border-control-border px-2 py-1 text-xs">
          Copy<span className="sr-only"> {label}</span>
        </button>
      </div>
      <p role="status" className="text-xs">{copied === "yes" ? "Copied." : copied === "no" ? "Could not copy; select the text instead." : ""}</p>
    </div>
  );
}

export const AboutPanel = forwardRef<AboutPanelHandle, { provenance: Provenance | null; release: string | undefined }>(function AboutPanel(
  { provenance: p, release },
  ref,
) {
  const dialog = useRef<HTMLDialogElement>(null);
  useImperativeHandle(ref, () => ({
    open: (section) => {
      const d = dialog.current;
      if (!d) return;
      if (!d.open) d.showModal();
      const target = d.querySelector<HTMLElement>(section === "data" ? "#panel-data" : "#panel-about");
      target?.focus();
      target?.scrollIntoView({ block: "start" });
    },
  }));
  return (
    <dialog
      ref={dialog}
      aria-labelledby="panel-title"
      className="about-panel bg-surface text-fg"
      data-testid="about-panel"
      // A click on the backdrop (outside the sheet) closes it, as Esc does.
      onClick={(e) => e.target === dialog.current && dialog.current.close()}
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <h2 id="panel-title" className="text-lg font-semibold">About and data</h2>
        <button type="button" onClick={() => dialog.current?.close()} className="ml-auto rounded-md border border-control-border px-3 py-1 text-sm">
          Close
        </button>
      </div>
      <div className="space-y-6 px-4 py-4">
        <section aria-labelledby="panel-about" data-testid="about">
          <h3 id="panel-about" tabIndex={-1} className="text-base font-semibold">About chAMReDB</h3>
          <div className="mt-3 space-y-3">
            <p className="font-semibold">Welcome to the chAMReDB website.</p>
            <p>(pronounced &lsquo;charmed&rsquo;, /tʃɑː(r)md/)</p>
            <p>
              This website aims to allow quick access to the{" "}
              <a className="underline" href="https://github.com/antunderwood/chamredb">chAMReDB</a> project.
            </p>
            <p>
              The project originated from the dilemma a scientist faces when choosing a database that stores antimicrobial
              resistance determinants. Multiple databases exist, each with comparative strengths and weaknesses. This
              project builds on the concepts of the hAMRonization project, aiming to aggregate and combine the information
              contained in the metadata associated with each database. The problem is exacerbated by the fact that
              equivalent antimicrobial resistance genes (ARGs) can be named differently in each database.
            </p>
            <div>
              <p>The hypothesis for the project is as follows:</p>
              <ul className="list-disc pl-6">
                <li>given a match in one database,</li>
                <li>find the matches in other databases,</li>
                <li>
                  aggregate the combined descriptive information pertaining to antimicrobial resistance contained in the
                  union of the metadata, and report this to the user so that they can make intelligent, informed choices.
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold">Databases used</h4>
              <ul className="list-disc pl-6">
                {DATABASE_LINKS.map(([name, href]) => (
                  <li key={href}>
                    <a className="underline" href={href}>{name}</a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
        <section aria-labelledby="panel-data" data-testid="provenance">
          <h3 id="panel-data" tabIndex={-1} className="text-base font-semibold">Sources and checksums</h3>
          {!release ? (
            <p className="mt-2 text-muted">Demo data: a hand-written test graph, not a ChamRedB release. It has no release provenance.</p>
          ) : !p ? (
            <p className="mt-2 text-muted">The release provenance has not loaded; see the message in the footer.</p>
          ) : (
            <div className="mt-2 text-sm">
              <p>
                Release {p.release}, built {p.date}. <a className="underline" href={p.source}>Release page</a>.
              </p>
              <p className="mt-1">Source databases:</p>
              <ul className="list-disc pl-5 [overflow-wrap:anywhere]">
                {p.databases.map((d) => (
                  <li key={d.database}>
                    {DB_LABEL[d.database] ?? d.database} {d.database === "resfinder" ? "git commit " : ""}{d.release}, retrieved {d.retrieved}
                  </li>
                ))}
              </ul>
              <p className="mt-1">Graph built with {p.tool}.</p>
              <Checksum label="Release graph.json sha256 (a build input, see the release page):" value={p.graphSha256} />
              <Checksum label="Release data_manifest.json sha256 (the record of the source database files):" value={p.manifestSha256} />
              <p className="mt-2">The checksums detect accidental change only; they do not prove who produced the files.</p>
            </div>
          )}
        </section>
      </div>
    </dialog>
  );
});
