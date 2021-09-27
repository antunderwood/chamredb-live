import Link from "next/dist/client/link"
export default function About() {
  return (
    <>
      <div className="mt-4">
        Welcome to the chAMReDB (pronounced 'charmed' /tʃɑː(r)md/) website.
      </div>
      <div>
        This website aims to allow quick access to the <Link href="https://gitlab.com/antunderwood/chamredb"><a className="text-blue-700 dark:text-blue-300">chAMR😍Db</a></Link> project.
      </div>
      <div className="mt-4">
        This project originated from the dilema a scientist faces when choosing a database that stores antimicrobial resistance determinants. Multiple databases exist with comparative strengths and weaknesses. This project builds on the concepts of the haAMRonization project aiming to aggeregate and combine the information contained within the metadata associated with each project. The problem is exacerbated by the fact that the equivalent antimicrobial resistance genes (ARGs) can be named differently in each database.
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
    </>
  )
}
