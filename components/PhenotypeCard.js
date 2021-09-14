import React from "react";
import PhenotypeListItem from "./PhenotypeListItem";

const PhenotypeCard = React.memo(
  (props) => {
    return (
      <div
        className="rounded-lg pt-6 pl-6 pr-6 pb-2 bg-gray-300 dark:bg-gray-800"
      >
        <div className='font-bold text-lg'>Phenotype</div>
        <ul>
          {
            props.phenotypeData.phenotype ?
              <PhenotypeListItem
                phenotype = {props.phenotypeData.phenotype}
              />
              : null
          }
          {
            props.phenotypeData.additional_phenotype ?
            <PhenotypeListItem
              phenotype = {props.phenotypeData.additional_phenotype}
            />
            : null
          }
        </ul>
      </div>
    );
  }
);  

PhenotypeCard.displayName = "PhenotypeCard";

export default PhenotypeCard;
    