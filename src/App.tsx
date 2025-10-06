import React, { useState } from "react";
import RadarCanvas from "./components/RadarCanvas";
import ControlPanel from "./components/ControlPanel";

type CATKeys = "NewCAT21" | "CAT10" | "CAT21" | "CAT240" | "CAT48";

const App: React.FC = () => {
  const [showCAT, setShowCAT] = useState<Record<CATKeys, boolean>>({
    NewCAT21: true,
    CAT10: true,
    CAT21: true,
    CAT240: true,
    CAT48: true,
  });

  const toggleCAT = (cat: CATKeys) => {
    setShowCAT((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  return (
    <div style={{ background: "#111", height: "100vh", color: "white" }}>
      <h1 style={{ textAlign: "center" }}>Radar ASTERIX Simulation</h1>
      <ControlPanel toggleCAT={toggleCAT} state={showCAT} />
      <RadarCanvas
        wsUrl="ws://localhost:8080"
        showCAT10={showCAT.CAT10}
        showCAT21={showCAT.CAT21}
        showCAT240={showCAT.CAT240}
        showCAT48={showCAT.CAT48}
      />
    </div>
  );
};

export default App;

