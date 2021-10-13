import React from "react";
import OtherInfoValue from "./OtherInfoValue";

const OtherInfoCard = React.memo(
  (props) => {
    return (
      <div
        className="rounded-lg p-6 bg-gray-300 dark:bg-gray-800"
      >
        <div className='font-bold text-lg'>Other Metadata</div>
        <ul>
          {
            Object.entries(props.otherInfo).map(([item, value])=> (
              <>
                <li
                  className="bg-green-700 dark:bg-green-300 text-white dark:text-gray-800 py-1 px-2 rounded-sm"
                  key={item+value}
                >
                  {item}
                </li>
                <ul className="list-disc ml-8">
                  <OtherInfoValue item={item} value={value}/>
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
    