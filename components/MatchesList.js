import React from "react";

import MatchListItem from "./MatchListItem";
import NoMatchListItem from "./NoMatchListItem";

class MatchesList extends React.PureComponent {

  render() {
    const { props } = this;
    const databases = ["card", "ncbi", "resfinder"];

    if (props.matches.length === 0) {
      return null;
    }

    return (
      <>
      {
        databases.filter(database => database !== props.queryDatabase).map(database => {
            const match = props.matches.filter(match => match.targetData.database === database)[0];
            if (match){
              return <MatchListItem match={match}/>
            } else {
              return <NoMatchListItem database={database}/>
            }
          }
        )
      }
      </>
    );
  }
  
}

MatchesList.displayName = "MatchesList";

export default MatchesList;