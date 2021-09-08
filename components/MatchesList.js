import React from "react";

import styles from "../styles/MatchesList.module.css";

class MatchesList extends React.PureComponent {

  render() {
    const { props } = this;

    if (props.matches.length === 0) {
      return null;
    }

    return (
      <ul
        className={styles.list}
      >
        {
          props.matches.map((match, index) => (
            <li key={index}>
              {JSON.stringify(match)}
            </li>
          ))
        }
      </ul>
    );
  }
  
}

MatchesList.displayName = "MatchesList";

export default MatchesList;