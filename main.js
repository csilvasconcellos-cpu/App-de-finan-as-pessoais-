import React from "react";
import { createRoot } from "react-dom/client";

function App() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-blue-600">
        SimpliFinance funcionando
      </h1>
      <p className="mt-2">Se você está vendo isso, o deploy deu certo.</p>
    </div>
  );
}

const root = createRoot(document.getElementById("root"));
root.render(<App />);
