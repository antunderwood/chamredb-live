import Link from "next/dist/client/link"
export default function About() {
  return (
    <>
      <div className="mt-4 font-bold">
        Welcome to the chAMReDB website.
      </div>
      <div>
        (pronounced &apos;charmed&apos; /tʃɑː(r)md/) 
      </div>
      <div className="mt-4">
        This website aims to allow quick access to the <Link href="https://gitlab.com/antunderwood/chamredb"><a className="text-blue-700 dark:text-blue-300">chAMR😍Db</a></Link> project.
      </div>
      <div>
        The project originated from the dilema a scientist faces when choosing a database that stores antimicrobial resistance determinants. Multiple databases exist with comparative strengths and weaknesses. This project builds on the concepts of the haAMRonization project aiming to aggeregate and combine the information contained within the metadata associated with each project. The problem is exacerbated by the fact that the equivalent antimicrobial resistance genes (ARGs) can be named differently in each database.
      </div>
      <div className="mt-4">
        The hypothesis for the project is as follows:
        <ul className="list-disc ml-6">
          <li>
            given a match in one database
          </li>
          <li>
            find the matches in other databases
          </li>
          <li>
            aggregate the combined desriptive information pertaining to antimicrobial resistance contained in the union of the metadata report this to user for them to make intelligent informed choices
          </li>
        </ul>
      </div>
      <div className="mt-4 font-bold">
        Databases used
      </div>
      <div>
      <ul className="list-disc ml-6">
          <li>
            <Link href="https://card.mcmaster.ca/">
              <a className="text-blue-700 dark:text-blue-300">The Comprehensive Antibiotic Resistance Database (CARD)</a>
            </Link>
          </li>
          <li>
            <Link href="https://www.ncbi.nlm.nih.gov/pathogens/antimicrobial-resistance/AMRFinder/">
              <a className="text-blue-700 dark:text-blue-300">NCBI AMRFinderPlus Database</a>
            </Link>
          </li>
          <li>
            <Link href="https://bitbucket.org/genomicepidemiology/resfinder_db/src/master/">
              <a className="text-blue-700 dark:text-blue-300">The Resfinder Database</a>
            </Link>
          </li>
        </ul>
      </div>
    </>
  )
}
