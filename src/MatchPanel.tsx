import { Card, Chip, ChipRow, Field, MetadataCard, PhenotypeCard } from "./Cards";
import { isBelow, matchDetails } from "./cardModel";
import type { Match } from "./types";

// One match of the query, as three cards: the match's own Phenotype and Other metadata (never the query's) and
// Match details. `weak`: the group's top identity is below the weak-evidence line, so the top match is
// "Highest identity shown", not "Best".
export function MatchPanel({ match, native, weak, weakBelow }: { match: Match; native: string; weak: boolean; weakBelow: number }) {
  const d = matchDetails(match, weak);
  const { entry } = match;
  return (
    <li tabIndex={-1} className="rounded-2xl bg-panel p-3 sm:p-4" data-match={entry.id} data-best={d.badge ?? undefined}>
      <h3 className="mb-3">
        <ChipRow>
          <Chip kind="match">Match</Chip> <Chip kind="db">{entry.database}</Chip> <Chip kind="name">{entry.name} ({native})</Chip>
        </ChipRow>
      </h3>
      <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.35fr)_minmax(0,1fr)]">
        <PhenotypeCard entry={entry} of="match" />
        <MetadataCard entry={entry} />
        <Card level={4} title="Match details" data-field="match-details">
          <dl>
            <Field label="Identity" field="identity">
              {d.identity}
              {d.badge && (
                <strong
                  className={
                    d.badge === "highest"
                      ? "mt-1 block w-fit rounded border border-border px-1.5 py-0.5 text-xs text-muted"
                      : "ml-2 rounded bg-accent px-1.5 py-0.5 text-xs text-accent-fg"
                  }
                >
                  {d.badge === "highest" ? "Highest identity shown" : "Best"}
                </strong>
              )}
              {!weak && isBelow(match.identity, weakBelow) && (
                <span className="mt-1 block text-sm text-muted" data-field="below-line">
                  Below {Math.round(weakBelow * 100)}% identity: weak evidence of equivalence.
                </span>
              )}
            </Field>
            <Field label="Coverage" field="coverage">{d.coverage}</Field>
            <Field label="Type" field="type"><span data-type={d.type}>{d.typeLabel}</span></Field>
          </dl>
        </Card>
      </div>
    </li>
  );
}
