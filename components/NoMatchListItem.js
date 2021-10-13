import React from "react";


const NoMatchListItem = React.memo(
  (props) => {
    const databases = {
      "card": "Card",
      "ncbi": "NCBI",
      "resfinder": "Resfinder",
    };
    return(
      <div key={"match-" + props.database} className="bg-gray-50 dark:bg-gray-400 relative shadow-lg dark:shadow-white rounded-md mx-auto mt-8 mb-5 py-5 px-2">
      <div className="flex justify-start mr-auto absolute -top-5 shadow-lg">
        <span alt="" className="bg-red-700 dark:bg-red-300 rounded-l-md pl-3 pr-2 py-1 text-xl font-semibold text-white dark:text-gray-800">
          No Match
        </span>
        <span alt="" className="bg-yellow-500 dark:bg-yellow-300 rounded-r-md pl-3 pr-2 py-1 text-xl font-semibold text-gray-800">
          {databases[props.database]}
        </span>
      </div>
    </div>
    )
  }
);

NoMatchListItem.displayName = "NoMatchListItem";

export default NoMatchListItem;