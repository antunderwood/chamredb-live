import React from "react";

const MatchCard = React.memo(
  (props) => {
    const hit_types = {
      "RBH" : "Reciprocal Best Hit",
      "OWH" : "One Way Hit",
    }
    return (
      <div
        className="rounded-lg p-6 bg-gray-300 dark:bg-gray-800"
      >
        <div className='font-bold text-lg'>Match Details</div>
        <div className="bg-green-700 dark:bg-green-300 text-white dark:text-gray-800 py-1 px-2 rounded-sm">Identity</div>
        <div>{`${Number(props.edgeData.identity*100).toFixed(1)}%`}</div>
        <div className="bg-green-700 dark:bg-green-300 text-white dark:text-gray-800 py-1 px-2 rounded-sm">Coverage</div>
        <div>{`${Number(props.edgeData.coverage*100).toFixed(1)}%`}</div>
        <div className="bg-green-700 dark:bg-green-300 text-white dark:text-gray-800 py-1 px-2 rounded-sm">Type</div>
        <div>{hit_types[props.edgeData.type]}</div>
      </div>
    );
  }
);  

MatchCard.displayName = "MatchCard";

export default MatchCard;
    