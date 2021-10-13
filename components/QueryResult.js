import React from "react";
import PhenotypeCard from "./PhenotypeCard";
import OtherInfoCard from "./OtherInfoCard";
import MatchesList from "./MatchesList";

const QueryResult = React.memo(
  (props) => {
    return (
      <div className="bg-gray-700 dark:bg-gray-100 relative shadow-lg dark:shadow-white rounded-md mx-auto mt-8 pt-5 pb-1 px-2">
        <div className="flex justify-start mr-auto absolute -top-5 shadow-lg">
          <span alt="" className="bg-blue-700 dark:bg-blue-300 rounded-l-md pl-3 pr-2 py-1 text-xl font-semibold text-white dark:text-gray-800">
            Query
          </span>
          <span alt="" className="bg-yellow-500 dark:bg-yellow-300 pl-3 pr-2 py-1 text-xl font-semibold text-gray-800">
            {props.query.database}
          </span>
          <span alt="" className="bg-red-700 dark:bg-red-300 rounded-r-md pl-2 pr-3 py-1 text-xl font-semibold text-gray-50 dark:text-gray-800">
            {props.query.name}
            {props.query.name === props.query.id ? null : ` (${props.query.id})`}
          </span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-2">
          <PhenotypeCard
            phenotypeData = {props.query}
          />
          <OtherInfoCard
            otherInfo = {(({ database, name, phenotype, additional_phenotype, id, ...other }) => other)(props.query)}
          />
        </div>
        <MatchesList
          queryDatabase={props.query.database}
          matches={props.matches}
        />
      </div>
    );
  }
)

QueryResult.displayName = "QueryResult";

export default QueryResult;