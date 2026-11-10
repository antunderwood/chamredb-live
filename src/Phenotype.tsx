import { additionalPhenotypeText, hasPhenotype, phenotypeText } from "./phenotypeText";
import type { Entry } from "./types";

// Phenotype text is data: rendered as plain text (React escapes it) and wrapped, never truncated.
function Value({ text, label, missing }: { text: string; label: string; missing?: boolean }) {
  return (
    <>
      {label}: <span data-phenotype className={missing ? "italic" : undefined}>{text}</span>
      {missing && " in this database"}
    </>
  );
}

// Header block for the entry that was looked up.
export function EntryHeader({ entry }: { entry: Entry }) {
  const extra = additionalPhenotypeText(entry);
  return (
    <section aria-label="Query entry" className="mt-6 rounded-lg border border-border bg-surface p-4">
      <h2 className="text-lg font-semibold break-words">{entry.name}</h2>
      <p className="text-sm text-muted break-words">{entry.id} ({entry.database})</p>
      <p className="mt-2 break-words" data-field="phenotype">
        <Value label="Phenotype" text={phenotypeText(entry)} missing={!hasPhenotype(entry)} />
      </p>
      {extra && (
        <p className="mt-1 break-words" data-field="additional-phenotype"><Value label="Additional phenotype" text={extra} /></p>
      )}
      {!hasPhenotype(entry) && (
        <p className="mt-1 text-sm text-muted">
          This is a gap in the source record, not a statement that the gene confers no resistance.
        </p>
      )}
    </section>
  );
}

// Compact phenotype line of one match: the phenotype of the matched entry, not of the query.
export function MatchPhenotype({ entry }: { entry: Entry }) {
  const extra = additionalPhenotypeText(entry);
  return (
    <span className="mt-0.5 block break-words text-sm text-muted" data-field="match-phenotype">
      <Value label="Phenotype of this match" text={phenotypeText(entry)} missing={!hasPhenotype(entry)} />
      {!hasPhenotype(entry) && " (a gap in the source record, not evidence of no resistance)"}
      {extra && (
        <>
          {"; "}
          <Value label="additional phenotype" text={extra} />
        </>
      )}
    </span>
  );
}
