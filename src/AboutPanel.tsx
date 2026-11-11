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

function Checksum({ label, name, value }: { label: string; name: string; value: string }) {
  const [copied, setCopied] = useState<"yes" | "no" | null>(null);
  const copy = () =>
    // navigator.clipboard is missing outside a secure context: the Promise wrapper turns that into the fallback text.
    Promise.resolve()
      .then(() => navigator.clipboard.writeText(value))
      .then(() => setCopied("yes"))
      .catch(() => setCopied("no"))
      .finally(() => window.setTimeout(() => setCopied(null), 4000)); // clear it, so a second copy is announced again
  return (
    <div className="mt-2">
      <p>{label}</p>
      <div className="mt-1 flex items-start gap-2">
        <code className="min-w-0 flex-1 break-all rounded bg-panel px-2 py-1 text-xs" data-sha={name}>{value}</code>
        <button type="button" onClick={copy} className="shrink-0 rounded-md border border-control-border px-2 py-1 text-xs">
          Copy<span className="sr-only"> {name}</span>
        </button>
      </div>
      <p role="status" className="text-xs" data-copy-status={name}>{copied === "yes" ? "Copied." : copied === "no" ? "Could not copy; select the text instead." : ""}</p>
    </div>
  );
}

// The provenance text, unchanged from the old footer. Shared by the panel (with copy buttons) and the footer's
// print-only copy, so a printed or saved page still records the source database versions and checksums.
export function ProvenanceText({ p, copy }: { p: Provenance; copy: boolean }) {
  return (
    <div className="text-sm" data-testid={copy ? undefined : "provenance-print"}>
      <p data-field="release">
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
      {copy ? (
        <>
          <Checksum label="Release graph.json sha256 (a build input, see the release page):" name="graph.json sha256" value={p.graphSha256} />
          <Checksum label="Release data_manifest.json sha256 (the record of the source database files):" name="data_manifest.json sha256" value={p.manifestSha256} />
        </>
      ) : (
        <>
          <p className="mt-1 break-all">Release graph.json sha256 (a build input, see the release page): <code>{p.graphSha256}</code></p>
          <p className="break-all">Release data_manifest.json sha256 (the record of the source database files): <code>{p.manifestSha256}</code></p>
        </>
      )}
      <p className="mt-2">The checksums detect accidental change only; they do not prove who produced the files.</p>
    </div>
  );
}

export const AboutPanel = forwardRef<AboutPanelHandle, { provenance: Provenance | null; error: string | null; release: string | undefined }>(function AboutPanel(
  { provenance: p, error, release },
  ref,
) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const downOnBackdrop = useRef(false);
  // A click closes the sheet only when it both started and ended outside the sheet's box (on the backdrop), so a text
  // selection dragged out of the sheet, or a click on empty space inside it, never closes it.
  const outside = (e: { clientX: number; clientY: number }) => {
    const r = dialog.current!.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };
  useImperativeHandle(ref, () => ({
    open: (section) => {
      const d = dialog.current;
      if (!d) return;
      // Remember the opener ourselves: Safari does not focus a button on a mouse click, so the browser's own
      // "previously focused element" can be the body.
      if (!d.open) opener.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
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
      onPointerDown={(e) => (downOnBackdrop.current = outside(e))}
      onClick={(e) => downOnBackdrop.current && outside(e) && dialog.current?.close()}
      onClose={() => opener.current?.focus()}
    >
      {/* Sticky, so Close stays in reach on a phone, where the sheet is full width and there is no backdrop to tap. */}
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-surface px-4 py-3">
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
            <p className="mt-2 text-muted">Demo data: not the pinned chAMReDB release, so there is no release provenance.</p>
          ) : error ? (
            <p className="mt-2 text-danger">{error}</p>
          ) : !p ? (
            <p className="mt-2 text-muted">Loading the release provenance…</p>
          ) : (
            <div className="mt-2">
              <ProvenanceText p={p} copy />
            </div>
          )}
        </section>
      </div>
    </dialog>
  );
});
