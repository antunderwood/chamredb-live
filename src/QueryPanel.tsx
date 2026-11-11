import type { HTMLAttributes } from "react";
import { Chip, ChipRow, MetadataCard, PhenotypeCard } from "./Cards";
import type { Entry } from "./types";

// The entry that was looked up: chips (Query, database, name with id), then its Phenotype and Other metadata cards.
export function QueryPanel({ entry, pair }: { entry: Entry; pair?: HTMLAttributes<HTMLElement> }) {
  // tabIndex -1: the picture can move focus to this card ("L" on a node); `pair` lights it up with its node.
  return (
    <section aria-label="Query entry" className="mt-6 rounded-2xl bg-panel p-3 sm:p-4 lg:mt-0" data-query={entry.id} tabIndex={-1} {...pair}>
      <h2 className="mb-3">
        <ChipRow>
          <Chip kind="query">Query</Chip> <Chip kind="db">{entry.database}</Chip> <Chip kind="name">{entry.name} ({entry.id})</Chip>
        </ChipRow>
      </h2>
      <div className="grid gap-3 @xl:grid-cols-2" data-card-grid>
        <PhenotypeCard entry={entry} of="query" />
        <MetadataCard entry={entry} level={3} />
      </div>
    </section>
  );
}
