import type { Provenance } from "./provenance";

const CODE_URL = "https://github.com/antunderwood/chamredb-live";

// One line (#21, ADR 0006): the release id, always visible, and the ways into the About and data panel. A provenance
// load error stays a visible alert here, not hidden in the panel. A demo build (no release) has no footer.
export function Footer({
  release,
  provenance,
  error,
  onOpen,
}: {
  release: string | undefined;
  provenance: Provenance | null;
  error: string | null;
  onOpen: (section: "about" | "data") => void;
}) {
  if (!release) return null;
  return (
    <footer className="mx-auto mt-10 max-w-shell border-t border-border px-4 py-4 text-sm text-muted" data-testid="footer">
      {error && <p role="alert" className="mb-2 text-danger">{error}</p>}
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span data-testid="footer-release">
          Data: release {release}
          {provenance ? ` (built ${provenance.date})` : ""}
        </span>
        <span aria-hidden="true">·</span>
        <button type="button" className="underline underline-offset-2" onClick={() => onOpen("data")}>Sources and checksums</button>
        <span aria-hidden="true">·</span>
        <button type="button" className="underline underline-offset-2" onClick={() => onOpen("about")}>About</button>
        <span aria-hidden="true">·</span>
        <a className="underline underline-offset-2" href={CODE_URL}>Code</a>
      </p>
    </footer>
  );
}
