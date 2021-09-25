import React from "react";

const ExampleLink = React.memo(
  (props) => {
    const databases = {
      "card": "Card",
      "ncbi": "NCBI",
      "resfinder": "Resfinder",
    };
    return(
      <div
        onClick={() => props.onClick(props.database, props.id)}
        className="flex rounded-md bg-blue-100 dark:bg-blue-700 text-gray-800 dark:text-gray-100 p-4 mb-2 mr-2 justify-center"
      >
          {databases[props.database]} and {props.id}
      </div>
    )
  }
);

ExampleLink.displayName = "ExampleLink";

export default ExampleLink;