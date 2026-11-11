import type { ReactNode } from "react";
import { hasOtherMetadata, otherMetadata } from "./cardModel";
import { PhenotypeList } from "./PhenotypeList";
import { additionalPhenotypeText, hasPhenotype, phenotypeText } from "./phenotypeText";
import type { Entry } from "./types";

// Shared pieces of the result panels. Colours are tokens only; every chip carries its meaning as text.

const CHIP_BG = { query: "bg-chip-query", db: "bg-chip-db", name: "bg-chip-name", match: "bg-chip-match" } as const;

export function Chip({ kind, children }: { kind: keyof typeof CHIP_BG; children: ReactNode }) {
  return <span data-chip={kind} className={`${CHIP_BG[kind]} px-3 py-1 text-base font-semibold text-chip-fg ${kind === "name" ? "min-w-[6rem] flex-1 [overflow-wrap:anywhere]" : "min-w-min shrink"}`}>{children}</span>;
}

// The name and, in brackets, the id the entry is looked up by. Left out when it would only repeat the name
// (resfinder:blaNDM-1 is named blaNDM-1): the database chip already carries the prefix.
export const nameWithId = (name: string, shown: string, native: string = shown) => (name === native ? name : `${name} (${shown})`);

// The joined chips of one panel heading (Query or Match, database, name with id).
// Callers put a space between chips: it is not drawn (flex), but it separates the words for a screen reader.
export function ChipRow({ children }: { children: ReactNode }) {
  return <span className="flex w-fit max-w-full flex-wrap overflow-hidden rounded-lg shadow-card">{children}</span>;
}

export function Card({ title, level = 4, children, ...rest }: { title: string; level?: 3 | 4; children: ReactNode } & Record<`data-${string}`, string>) {
  const Heading = `h${level}` as const;
  return (
    <div className="min-w-0 rounded-xl bg-surface p-3 shadow-card sm:p-4" {...rest}>
      <Heading className="mb-2 text-base font-semibold break-words">{title}</Heading>
      {children}
    </div>
  );
}

// One labelled value: a green label bar, then the value. dl/dt/dd so the pairing is in the markup.
export function Field({ label, field, children }: { label: string; field: string; children: ReactNode }) {
  return (
    <div data-field={field} className="mt-2 first:mt-0">
      <dt className="rounded bg-label px-2 py-1 text-sm font-semibold text-label-fg">{label}</dt>
      <dd className="mt-1 px-1 break-words">{children}</dd>
    </div>
  );
}

// The phenotype text of one entry, as stored: the list of pieces (or "not recorded" with its gap note), then the additional
// phenotype only when present. Used by the Phenotype cards and by the side-by-side view, so both say the same thing.
// `view` only changes the data attributes, so tests can tell the two places apart.
export function PhenotypeBody({ entry, of, view = "card" }: { entry: Entry; of: "query" | "match"; view?: "card" | "side" }) {
  const extra = additionalPhenotypeText(entry);
  const side = view === "side";
  return (
    <>
      {hasPhenotype(entry) ? (
        <div {...{ [side ? "data-side-primary" : "data-phenotype-primary"]: "" }}><PhenotypeList text={phenotypeText(entry)} /></div>
      ) : (
        <div {...{ [side ? "data-side-primary" : "data-phenotype-primary"]: "" }}>
          <p className="break-words">
            <span {...{ [side ? "data-side-gap" : "data-phenotype"]: "" }} className="italic">{phenotypeText(entry)}</span> in this database
          </p>
          <p className="mt-1 text-sm text-muted break-words">
            {of === "match"
              ? "A gap in the source record, not evidence of no resistance."
              : "This is a gap in the source record, not a statement that the gene confers no resistance."}
          </p>
        </div>
      )}
      {extra && (
        <div className="mt-3" data-field={side ? "side-additional-phenotype" : "additional-phenotype"}>
          <p className="mb-1 text-sm font-semibold text-muted">Additional phenotype</p>
          <PhenotypeList text={extra} />
        </div>
      )}
    </>
  );
}

// Phenotype of the entry (query) or of a match. The text is the stored text, never rephrased; the additional
// phenotype is a separate list, shown only when present. "Not recorded" is a gap in the source record.
export function PhenotypeCard({ entry, of }: { entry: Entry; of: "query" | "match" }) {
  const level = of === "query" ? 3 : 4; // under the query panel's h2, under a match panel's h3
  return (
    <Card level={level} title={of === "match" ? "Phenotype of this match" : "Phenotype"} data-field={of === "match" ? "match-phenotype" : "phenotype"}>
      <PhenotypeBody entry={entry} of={of} />
    </Card>
  );
}

// PMID links, is_a and product, each only when the entry has it. Text is as stored.
export function MetadataCard({ entry, level = 4 }: { entry: Entry; level?: 3 | 4 }) {
  const m = otherMetadata(entry);
  return (
    <Card level={level} title="Other metadata" data-field="other-metadata">
      {hasOtherMetadata(m) ? (
        <dl>
          {m.pmids.length > 0 && (
            <Field label="PMID" field="pmid">
              <ul className="list-disc pl-5 marker:text-label">
                {m.pmids.map((p) => (
                  <li key={p.id} data-pmid={p.id}>
                    {p.href ? (
                      <a className="underline decoration-label decoration-2 underline-offset-2" href={p.href} target="_blank" rel="noopener noreferrer">
                        {p.id}
                        <span className="sr-only"> (PubMed, opens in new tab)</span>
                      </a>
                    ) : (
                      p.id
                    )}
                  </li>
                ))}
              </ul>
            </Field>
          )}
          {m.isA && <Field label="is_a" field="is-a">{m.isA}</Field>}
          {m.product && <Field label="product" field="product">{m.product}</Field>}
        </dl>
      ) : (
        <p className="text-muted">No other metadata recorded in this database.</p>
      )}
    </Card>
  );
}
