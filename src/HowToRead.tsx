// The long explanations, collapsed by default (native <details>: keyboard and screen reader support for free).
// The short privacy line and the weak-evidence warning stay visible in the page; everything else that used to sit
// above the results is here, in the original words, except the Weak evidence paragraph, which explains the visible warning.
export function HowToRead({ weakPct }: { weakPct: number }) {
  return (
    <details className="mt-4 rounded-lg border border-border bg-surface p-4" data-testid="how-to-read">
      <summary className="cursor-pointer font-semibold">How to read this</summary>
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
          <h2 className="font-semibold">Weak evidence</h2>
          <p className="mt-1">
            When every match shown in a database is below {weakPct}% identity, that group is marked as weak evidence
            of equivalence and its highest identity is labelled Highest identity shown, not Best; it still ignores
            coverage and the match type, and all the matches stay visible. The {weakPct}% is a working default taken
            from the earlier site, not a validated cut-off. The warning itself stays with the group it applies to.
          </p>
        </div>
        <div>
          <h2 className="font-semibold">Privacy and links</h2>
          <p className="mt-1">
            All searches run in your browser. The web host keeps ordinary access logs of page and data file requests.
            The address of this page records your search after the # sign, so you can share it; your browser does not
            send that part to this site, but anyone you give the link to can read it.
          </p>
        </div>
      </div>
    </details>
  );
}
