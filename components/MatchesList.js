import React from "react";

import MatchCard from "./MatchCard";
import OtherInfoCard from "./OtherInfoCard";
import PhenotypeCard from "./PhenotypeCard"

class MatchesList extends React.PureComponent {
  databases = {
    "card": "Card",
    "ncbi": "NCBI",
    "resfinder": "Resfinder",
  }

  render() {
    const { props } = this;

    if (props.matches.length === 0) {
      return null;
    }

    return (
      <>
      {
        props.matches.map((match, index) => (
          <div key={"match-" + index} className="bg-gray-50 dark:bg-gray-400 relative shadow-lg dark:shadow-white rounded-md mx-auto mt-8 mb-5 py-5 px-2">
            <div className="flex justify-start mr-auto absolute -top-5 shadow-lg">
              <span alt="" className="bg-purple-700 dark:bg-purple-300 rounded-l-md pl-3 pr-2 py-1 text-xl font-semibold text-white dark:text-gray-800">
                Match
              </span>
              <span alt="" className="bg-yellow-500 dark:bg-yellow-300 pl-3 pr-2 py-1 text-xl font-semibold text-gray-800">
                {this.databases[match.targetData.database]}
              </span>
              <span alt="" className="bg-red-700 dark:bg-red-300 rounded-r-md pl-2 pr-3 py-1 text-xl font-semibold text-gray-50 dark:text-gray-800">
                {match.targetData.name}
                {match.targetData.name === match.targetData.id ? null : ` (${match.targetData.id})`}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">
              <PhenotypeCard
                phenotypeData = {match.targetData}
              />
              <OtherInfoCard
                otherInfo = {(({ database, name, phenotype, additional_phenotype, ...other }) => other)(match.targetData)}
              />
              <MatchCard 
                edgeData = {match.edgeData}
              />
            </div>
          </div>
        ))
      }
      </>
    );
  }
  
}

MatchesList.displayName = "MatchesList";

export default MatchesList;