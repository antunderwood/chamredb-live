import type { HTMLAttributes } from "react";
import { Bar } from "./Bar";
import { Card, Chip, ChipRow, Field, MetadataCard, PhenotypeCard } from "./Cards";
import { scale } from "./bars";
import { cardDomId, isBelow, matchDetails } from "./cardModel";
import { showInNetwork } from "./NetworkView";
import type { Match } from "./types";

// One match of the query, as three cards: the match's own Phenotype and Other metadata (never the query's) and
// Match details. `weak`: the group's top identity is below the weak-evidence line, so the top match is
// "Highest identity shown", not "Best".
export function MatchPanel({ match, native, weak, weakBelow, pair }: { match: Match; native: string; weak: boolean; weakBelow: number; pair?: HTMLAttributes<HTMLElement> }) {
  const d = matchDetails(match, weak);
  const { entry } = match;
  // tabIndex -1: the picture can move focus to this card ("L" on a node); `pair` lights it up with its node.
  return (
    <li id={cardDomId(entry.id)} className="rounded-2xl bg-panel p-3 sm:p-4" data-match={entry.id} data-best={d.badge ?? undefined} tabIndex={-1} {...pair}>
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3>
          <ChipRow>
            <Chip kind="match">Match</Chip> <Chip kind="db">{entry.database}</Chip> <Chip kind="name">{entry.name} ({native})</Chip>
          </ChipRow>
        </h3>
        <button
          type="button"
          data-action="show-in-network"
          className="rounded-md border border-control-border bg-surface px-2.5 py-1 text-sm hover:border-fg"
          onClick={() => showInNetwork(entry.id)}
        >
          Show in network<span className="sr-only"> ({entry.id})</span>
        </button>
      </div>
      <div className="grid gap-3 @2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1.35fr)_minmax(0,1fr)]" data-card-grid>
        <PhenotypeCard entry={entry} of="match" />
        <MetadataCard entry={entry} />
        <Card level={4} title="Match details" data-field="match-details">
          <dl>
            <Field label="Identity" field="identity">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="w-32 shrink-0"><Bar value={match.identity} kind="identity" /></span>
                <span className="tabular-nums" data-value="identity">{d.identity}</span>
              </span>
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
            <Field label="Coverage" field="coverage">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="w-32 shrink-0"><Bar value={match.coverage} kind="coverage" /></span>
                <span className="tabular-nums" data-value="coverage">{d.coverage}</span>
                {scale(match.coverage).overflow && <span className="text-xs text-muted" data-overflow-note>{" "}(over 100%)</span>}
              </span>
            </Field>
            <Field label="Type" field="type"><span data-type={d.type}>{d.typeLabel}</span></Field>
          </dl>
        </Card>
      </div>
    </li>
  );
}
