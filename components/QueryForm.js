import axios from "axios";
import React from "react";
import MatchesList from "./MatchesList";
import Textfield from "./Textfield";

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
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-6 py-8 dark:bg-gray-400'>
          <div className='flex justify-center lg:justify-start'>
            <Textfield
              value={state.database}
              label="Database"
              onChange={(value) => this.setState({ database: value })}
            />
          </div>
          <div className='flex justify-center lg:justify-start'>
            <Textfield
              value={state.id}
              label="ID"
              onChange={(value) => this.setState({ id: value })}
            />
          </div>
          <div className='flex justify-center lg:justify-start'>
            <button
              onClick={this.submitQuery}
            >
              Query
            </button>
          </div>
        </div>
        <div className='grid grid-cols-1 justify-center lg:grid-cols-3 lg:justify-start gap-6 bg-blue-200'>
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