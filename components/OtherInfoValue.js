import React from "react";
import Link from "next/dist/client/link";

const OtherInfoValue = React.memo(
  (props) => {
    if (props.value instanceof Array){
      return (
        <>
        {
          props.value.map((element, index) => (
            <li key={props.item + index} className="text-green-700 dark:text-green-300 text-2xl">
              <div className="text-black dark:text-white text-base">
                { props.item === "PMID"
                  ? <Link href={"https://pubmed.ncbi.nlm.nih.gov/" + element}>
                      <a className="text-blue-700 dark:text-blue-300" target="_blank"> {element}</a>
                    </Link>
                  : element
                }
              </div>
            </li>
          ))
        }
        </>
      )
    } else{
      return (
        props.value
      )
    }
  }
)

OtherInfoValue.displayName = "OtherInfoValue";

export default OtherInfoValue;
    