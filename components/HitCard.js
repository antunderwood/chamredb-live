import React from "react";

const HitCard = React.memo(
  (props) => {
    return (
      <div
        className="rounded-lg p-6 bg-gray-300 dark:bg-gray-800"
      >
        <div className='font-bold text-lg'>Hit Details</div>
        <div>Identity: {props.edgeData.identity}</div>
        <div>Coverage: {props.edgeData.coverage}</div>
        <div>Type: {props.edgeData.type}</div>
      </div>
    );
  }
);  

HitCard.displayName = "Hitcard";

export default HitCard;
    