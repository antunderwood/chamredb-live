import React from "react";

const OtherInfoCard = React.memo(
  (props) => {
    return (
      <div
        className="rounded-lg p-6 bg-gray-300 dark:bg-gray-800"
      >
        <div className='font-bold text-lg'>Other Metadata</div>
        <ul>
          {
             Object.entries(props.otherInfo).map(([key, value])=> (
              <>
                <li
                  className="bg-green-700 dark:bg-green-300 text-white dark:text-gray-800 py-1 px-2 rounded-sm"
                  key={key+value}
                >
                  {key}
                </li>
                <ul className="list-disc ml-8">
                  <li className="text-green-700 dark:text-green-300 text-2xl">
                    <div className="text-black dark:text-white text-base">{value}</div>
                  </li>
                </ul>
              </>
            ))
          }
        </ul>
      </div>
    );
  }
);  

OtherInfoCard.displayName = "OtherInfoCard";

export default OtherInfoCard;
    