import React from "react";

const ExampleLink = React.memo(
  (props) => {
    const databases = {
      "card": "Card",
      "ncbi": "NCBI",
      "resfinder": "Resfinder",
    };
    return(
      <li onClick={() => props.onClick(props.database, props.id)}>{databases[props.database]} and {props.id}</li>
    )
  }
);

ExampleLink.displayName = "ExampleLink";

export default ExampleLink;