import React from "react";
import string_utils from "../utils/string_utils";

const PhenotypeListItem = React.memo(
  (props) => {
    const [conferType, conferValues] = string_utils.extractPhenotype(props.phenotype)

    return (
      <>
        <li className="bg-green-700 dark:bg-green-300 text-white dark:text-gray-800 py-1 px-2 rounded-sm">{conferType}</li>
        <ul className="list-disc ml-8 mb-4">
          {
            conferValues.split(",").map((item, index) => (
              <li className="text-green-700 dark:text-green-300 text-2xl" key={"phenotype-" + index}>
                <div className="text-black dark:text-white text-base">{item}</div>
              </li>
            ))
          }
        </ul>
      </>
    );
  }
);  

PhenotypeListItem.displayName = "PhenotypeListItem";

export default PhenotypeListItem;
    