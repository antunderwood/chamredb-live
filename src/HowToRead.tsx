import { forwardRef, useImperativeHandle, useRef } from "react";

// The long explanations, collapsed by default (native <details>: keyboard and screen reader support for free).
// The short privacy line and the weak-evidence warning stay visible in the page; everything else that used to sit
// above the results is here, in the original words, except the Weak evidence paragraph, which explains the visible warning.
export interface HowToReadHandle {
  showPrivacy(): void;
}

export const HowToRead = forwardRef<HowToReadHandle, { weakPct: number }>(function HowToRead({ weakPct }, ref) {
  const details = useRef<HTMLDetailsElement>(null);
  const privacy = useRef<HTMLDivElement>(null);
  // The privacy link in the page head opens this section and moves focus to the full statement. It is a button, not an
  // address with a #: the address bar holds the search.
  useImperativeHandle(ref, () => ({
    showPrivacy() {
      if (details.current) details.current.open = true;
      privacy.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
      privacy.current?.focus({ preventScroll: true });
    },
  }));
  return (
    <details ref={details} className="mt-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm open:p-4 open:text-base" data-testid="how-to-read">
      <summary className="cursor-pointer font-semibold"><span aria-hidden="true">ⓘ </span>How to read this</summary>
      <div className="mt-3 space-y-4 text-sm">
        <div>
          <h2 className="font-semibold">Identity, coverage and Best</h2>
          <p className="mt-1">
            Identity: fraction of identical residues; coverage: alignment length / query length, so it can exceed 100%.
            Best is the highest identity in that database among the matches shown, by identity only: it ignores
            coverage and the match type.
          </p>
        </div>
        <div>
          <h2 className="font-semibold">RBH and OWH</h2>
          <p className="mt-1">RBH: reciprocal best hit; OWH: one-way hit (the reverse direction is not implied).</p>
        </div>
        <div>
          {/* Moved here unchanged from the network picture's caption (#22), which now has a drawn key and one sentence. */}
          <h2 className="font-semibold">Network picture</h2>
          <p className="mt-1" data-testid="howto-network">
            The same matches as the list of cards. Solid-line arrows run from the query and the percentage on them is the identity; after an expand, the lighter arrows run from the match that was expanded. Best is the highest identity in
            its database (ties all best), by identity only; in a group below 90% the label is Highest identity shown. Click a node or press Enter to make it the
            query; hover or focus shows its details. The + button on a match adds that entry&apos;s own matches.
          </p>
        </div>
        <div>
          <h2 className="font-semibold">Weak evidence</h2>
          <p className="mt-1">
            When every match shown in a database is below {weakPct}% identity, that group is marked as weak evidence
            of equivalence and its highest identity is labelled Highest identity shown, not Best; it still ignores
            coverage and the match type, and all the matches stay visible. The {weakPct}% is a working default taken
            from the earlier site, not a validated cut-off. The warning itself stays with the group it applies to.
          </p>
        </div>
        <div ref={privacy} tabIndex={-1} data-testid="howto-privacy">
          <h2 className="font-semibold">Privacy and links</h2>
          {/* The full statement: the sentence that used to sit above the results, word for word, without its pointer here (#26). */}
          <p className="mt-1" data-testid="privacy-full">
            Privacy: your searches never leave your browser, and this site loads no third-party scripts, fonts or
            analytics. The web host keeps ordinary access logs, and anyone you give a link to can read the search in it.
          </p>
          <p className="mt-1">
            All searches run in your browser. The web host keeps ordinary access logs of page and data file requests.
            The address of this page records your search after the # sign, so you can share it; your browser does not
            send that part to this site, but anyone you give the link to can read it.
          </p>
        </div>
      </div>
    </details>
  );
});
