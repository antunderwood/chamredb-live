import React from "react";

const Textfield = React.memo(
  (props) => {
    return (
      <label className='text-lg font-bold dark:bg-gray-700 dark:text-white p-2'>
        { props.label }
        <input className='ml-4 pl-1 dark:bg-gray-700 dark:text-white'
          type="text"
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
          onClick={props.onClick}
        />
      </label>
    );
  }
);  

Textfield.displayName = "Textfield";

export default Textfield;