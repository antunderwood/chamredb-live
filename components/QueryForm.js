import axios from "axios";
import React from "react";
import MatchesList from "./MatchesList";
import Textfield from "./Textfield";
import { Button } from "./Button";
import Dropdown from "./Dropdown";

class QueryForm extends React.PureComponent {
  state = {
    database: "resfinder",
    id: "blaNDM-1",
    matches: [],
  }

  submitQuery = () => {
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
        this.setState({ matches: data, error: null });
      })
      .catch(error => {
        this.setState({ error });
      })
  }

  renderMatches() {
    const { state } = this;

    if (state.error) {
      return (
        <div className='col-span-3'>
          {JSON.stringify(state.error)}
        </div>
      );
    }

    if (state.matches.length === 0) {
      return null;
    }

    return (
      <MatchesList
        matches={state.matches}
      />
    );
  }
  
  render() {
    const { state, props } = this;
    return (
      <>
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-6 py-8 dark:bg-gray-800 dark:text-white'>
          <div className='flex justify-center lg:justify-start'>
            <Dropdown
              value={state.database}
              items = {[["card", "Card"],["ncbi", "NCBI"], ["resfinder", "Resfinder"]]}
              selected = "resfinder"
              label="Database"
              onChange={(value) => this.setState({ database: value.trim() })}
            />  
          </div>
          <div className='flex justify-center lg:justify-start'>
            <Textfield
              value={state.id}
              label="ID"
              onChange={(value) => this.setState({ id: value.trim() })}
              onClick={(value) => this.setState({ id: ''})}
            />
          </div>
          <div className='flex justify-center lg:justify-start'>
            <Button
              onClick={this.submitQuery}
              className='bg-blue-600 text-white dark:bg-blue-200       dark:text-gray-800'
            >
              Query
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