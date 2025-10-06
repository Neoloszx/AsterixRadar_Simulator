import React from "react";

const ControlPanel = ({ toggleCAT, state }) => {
  return (
    <div style={{ margin: "10px", color:"white" }}>
      {["CAT10","CAT21","CAT240","CAT48"].map(cat => (
        <label key={cat} style={{ marginRight: "10px" }}>
          <input
            type="checkbox"
            checked={state[cat]}
            onChange={() => toggleCAT(cat)}
          /> {cat}
        </label>
      ))}
    </div>
  );
};

export default ControlPanel;

