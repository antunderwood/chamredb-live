import React from "react";

const Textfield = React.memo(
  (props) => {
    return (
      <label>
        { props.label }
        <input
          type="text"
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
        />
      </label>
    );
  }
);  

Textfield.displayName = "Textfield";

export default Textfield;