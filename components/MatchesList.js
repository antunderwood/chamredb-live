import React from "react";

import styles from "../styles/MatchesList.module.css";

class MatchesList extends React.PureComponent {

  render() {
    const { props } = this;

    if (props.matches.length === 0) {
      return null;
    }

    return (
      <div className='col-span-3 py-8'>
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
      </div>
    );
  }
  
}

MatchesList.displayName = "MatchesList";

export default MatchesList;