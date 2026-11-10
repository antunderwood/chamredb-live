// The old site's About page, kept as a collapsible section: no router, because the URL hash holds the search state.
// The links are plain outbound links the reader clicks; nothing is requested from them when the page loads.
const DATABASE_LINKS = [
  ["The Comprehensive Antibiotic Resistance Database (CARD)", "https://card.mcmaster.ca/"],
  ["NCBI AMRFinderPlus Database", "https://www.ncbi.nlm.nih.gov/pathogens/antimicrobial-resistance/AMRFinder/"],
  ["The ResFinder Database", "https://bitbucket.org/genomicepidemiology/resfinder_db/src/master/"],
] as const;

export function About() {
  return (
    <details className="mt-10 rounded-lg border border-border bg-surface p-4" data-testid="about">
      <summary className="cursor-pointer text-lg font-semibold">About chAMReDB</summary>
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
          <h2 className="font-semibold">Databases used</h2>
          <ul className="list-disc pl-6">
            {DATABASE_LINKS.map(([name, href]) => (
              <li key={href}>
                <a className="underline" href={href}>{name}</a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}
