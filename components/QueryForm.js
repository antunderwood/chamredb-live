import axios from "axios";
import React from "react";
import Textfield from "./Textfield";
import { Button } from "./Button";
import Dropdown from "./Dropdown";
import QueryResult from "./QueryResult";
import { ExclamationCircleIcon} from '@heroicons/react/outline';
import ExampleLink from "./ExampleLink";

class QueryForm extends React.PureComponent {
  state = {
    database: "resfinder",
    id: "blaNDM-1",
    submitted: false,
    query: null,
    matches: []
  }

  submitQuery = () => {
    const { state, props } = this;
    state.submitted = true;
    axios.post(
      "/api/query",
      {
        database: state.database,
        id: state.id,
      } 
    )
      .then(res => res.data)
      .then(data => {
        this.setState(
          { 
            query: data.query,
            matches: data.matches,
            error: null
          }
        );
      })
      .catch(error => {
        this.setState({ error });
      })
  }

  renderMatches() {
    const { state } = this;

    if (state.error) {
      return (
        <div className="bg-gray-700 dark:bg-gray-100 relative shadow-lg dark:shadow-white rounded-md mx-auto mt-8 pt-5 pb-1 px-2">
          <div className="grid grid-cols-1">
            {JSON.stringify(state.error)}
          </div>
        </div>
      );
    }
    if (state.submitted){
      if (state.query === null){
        return (
          <div className="grid grid-cols-1">
            <div className="rounded-md bg-red-700 text-white p-2 flex"><ExclamationCircleIcon className="h-6 w-6 mr-2"/>No entry in the<span className="font-bold whitespace-pre"> {state.database} </span> database matches<span className="font-bold whitespace-pre"> {state.id}</span></div>
          </div>
        );
      }
      else if (state.matches.length === 0) {
        return (
          <div className="grid grid-cols-1">
            <div className="rounded-md bg-red-700 text-white p-2 flex"><ExclamationCircleIcon className="h-6 w-6 mr-2"/>No matches in other databases for<span className="font-bold whitespace-pre"> {state.id} </span>from<span className="font-bold whitespace-pre"> {state.database}</span></div>
          </div>
        );
      }
      else {
        return (
          <QueryResult
            query={state.query}
            matches={state.matches}
          />
        );
      }
    }
  }
  
  updateDatabaseAndId = (database, id) => {
    console.log("here")
    this.setState(
      {database, id}
    )
  }

  render() {
    const { state, props } = this;
    return (
      <>
        <div>Some examples to try
          <ul className="list-disc ml-8">
            <ExampleLink
              database="card"
              id="ARO:3000230"
              onClick={this.updateDatabaseAndId}
              
            />
            <ExampleLink
              database="ncbi"
              id="WP_012695489.1"
              onClick={this.updateDatabaseAndId}
            />
            <ExampleLink
              database="ncbi"
              id="NG_050598.1"
              onClick={this.updateDatabaseAndId}
            />
            <ExampleLink
              database="resfinder"
              id="blaNDM-1"
              onClick={this.updateDatabaseAndId}
            />
          </ul>
        </div>
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-6 py-8 dark:bg-gray-800 dark:text-white'>
          <div className='flex justify-center lg:justify-start'>
            <Dropdown
              value={state.database}
              items={[["card", "Card"],["ncbi", "NCBI"], ["resfinder", "Resfinder"]]}
              defaultValue="resfinder"
              label="Database"
              onChange={(value) => this.setState({ database: value.trim() })}
            />  
          </div>
          <div className='flex justify-center lg:justify-start'>
            <Textfield
              value={state.id}
              label="ID"
              onChange={(value) => this.setState({ id: value.trim() })}
              onClick={(value) => this.setState({ id: '', submitted: false})}
            />
          </div>
          <div className='flex justify-center lg:justify-start'>
            <Button
              onClick={this.submitQuery}
              className='bg-blue-600 text-white dark:bg-blue-200 dark:text-gray-800 text-lg'
            >
              Search
            </Button>
          </div>
        </div>
        <div className='my-5'>
          { this.renderMatches() }
        </div>
      </>
    );
  }
}

// const QueryForm = React.memo(
//   (props) => {
//     const [ database, setDatabase ] = React.useState("resfinder");
//     const [ id, setID ] = React.useState("blaNDM-1");
//     const [ matches, setMatches ] = React.useState([]);
//     return (
//       <div>
//         <Textfield
//           value={database}
//           label="Database"
//           onChange={setDatabase}
//         />
//         <Textfield
//           value={id}
//           label="ID"
//           onChange={setID}
//         />
//         <button
//           onClick={() => {
//             axios.post(
//               "/api/query",
//               {
//                 database,
//                 id,
//               }
//             )
//               .then(res => res.data)
//               .then(data => {
//                 setMatches(matches);
//               })
//               .catch(error => {
//                 console.error({error})
//               })

//           }}
//           >
//             Query
//           </button>
//       </div>
//     );
//   }
// );

QueryForm.displayName = "queryForm";

export default QueryForm;