import { useId } from "react";
import { parsePhenotype } from "./parsePhenotype";

// Phenotype as a green label bar plus bullets. Pieces are plain text (React escapes them) and wrap, never truncated.
// The label drops the heading's trailing colon and space for display only; the stored text is recomposed from the
// parsed pieces in src/parsePhenotype.test.ts. No extra accessible text: the label and the list items are read
// once each, in order, which carries every piece (an aria-label copy would be read twice).
// A text without a recognised shape (including "not recorded", which callers get from phenotypeText) is shown
// as one paragraph, verbatim.
export function PhenotypeList({ text }: { text: string }) {
  const p = parsePhenotype(text);
  const labelId = useId();
  if (p.shape === "verbatim") return <p className="break-words" data-phenotype-list="verbatim">{text}</p>;
  return (
    <div data-phenotype-list={p.shape}>
      <p id={labelId} className="rounded bg-label px-2 py-1 text-sm font-semibold text-label-fg break-words">
        {p.heading.replace(/[:\s]+$/, "")}
      </p>
      <ul aria-labelledby={labelId} className="mt-1 list-disc py-1 pl-7 pr-1 text-fg marker:text-label">
        {p.items.map((item, i) => (
          <li key={i} className="break-words" data-phenotype-item>{item}</li>
        ))}
      </ul>
    </div>
  );
}
