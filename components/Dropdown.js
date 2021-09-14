import React from "react";

const Dropdown = React.memo(
  (props) => {
    return (
      <label className='text-lg font-bold dark:bg-gray-700 dark:text-white p-2'>
        { props.label }
        <select
          onChange={(event) => props.onChange(event.target.value)}
          className="ml-2"
        >
          {
            props.items.map((item, index) => (
              <option key={"dropdown-" + index} value={item[0]} selected={props.selected && item[0] === props.selected ? "selected" : null}>{item[1]}</option>
            ))
          }
        </select>
      </label>
    );
  }
);  

Dropdown.displayName = "Dropddown";

export default Dropdown;