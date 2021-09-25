import axios from "axios";
import React from "react";
import Textfield from "./Textfield";
import { Button } from "./Button";
import Dropdown from "./Dropdown";
import QueryResult from "./QueryResult";
import { ExclamationCircleIcon} from '@heroicons/react/outline';
import ExampleLink from "./ExampleLink";

const initialState = {
  database: "resfinder",
  id: "blaNDM-1",
  loading: false,
  result: null,
};
class QueryForm extends React.PureComponent {
  state = initialState;
  submitQuery = () => {
    this.setState(
      {
        loading: true,
        result: initialState.result,
      },
      this.postQuery
    )

  }

  postQuery = () => {
    const { state, props } = this;
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
            result: data,
            error: null,
            loading: false,
          }
        );
      })
      .catch(error => {
        this.setState(
          {
            error,
            loading:false,
          }
        );
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
    if (state.loading) {
      return (
        <div className="bg-gray-700 dark:bg-gray-100 relative shadow-lg dark:shadow-white rounded-md justify-center flex mx-auto mt-8 pt-5 pb-5 px-2">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      );
    }
    if (state.result){
      if (state.result.query === null){
        return (
          <div className="grid grid-cols-1">
            <div className="rounded-md bg-red-700 text-white p-2 flex">
              <ExclamationCircleIcon className="h-6 w-6 mr-2"/>No entry in the<span className="font-bold whitespace-pre"> {state.database} </span> database matches<span className="font-bold whitespace-pre"> {state.id}</span></div>
          </div>
        );
      }
      if (state.result.matches.length === 0) {
        return (
          <div className="grid grid-cols-1">
            <div className="rounded-md bg-red-700 text-white p-2 flex"><ExclamationCircleIcon className="h-6 w-6 mr-2"/>No matches in other databases for<span className="font-bold whitespace-pre"> {state.id} </span>from<span className="font-bold whitespace-pre"> {state.database}</span></div>
          </div>
        );
      }
      return (
        <QueryResult
          query={state.result.query}
          matches={state.result.matches}
        />
      );
    }
    return null;
  }

  queryWithDatabaseAndId = (database, id) => {
    this.setState(
      {database, id},
      () => this.submitQuery()
    );
  }

  clearResult = () => {
    this.setState(
      {
        ...initialState,
        id : '',
        database: this.state.database
      },
    );
  }

  render() {
    const { state, props } = this;
    return (
      <>
        <div>
          <div className="text-center lg:text-left">
            Some examples to try
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-4">
            <ExampleLink
              database="card"
              id="ARO:3000230"
              onClick={this.queryWithDatabaseAndId}
              
            />
            <ExampleLink
              database="ncbi"
              id="WP_012695489.1"
              onClick={this.queryWithDatabaseAndId}
            />
            <ExampleLink
              database="ncbi"
              id="NG_050598.1"
              onClick={this.queryWithDatabaseAndId}
            />
            <ExampleLink
              database="resfinder"
              id="blaNDM-1"
              onClick={this.queryWithDatabaseAndId}
            />
          </div>
        </div>
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-6 py-8 dark:bg-gray-800 dark:text-white'>
          <div className='flex justify-center lg:justify-start'>
            <Dropdown
              value={state.database}
              items={[["card", "Card"],["ncbi", "NCBI"], ["resfinder", "Resfinder"]]}
              label="Database"
              onChange={(value) => this.setState({ database: value.trim() })}
            />  
          </div>
          <div className='flex justify-center lg:justify-start'>
            <Textfield

              value={state.id}
              label="ID"
              onChange={(value) => this.setState({ id: value.trim() })}
              onClick={this.clearResult}
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