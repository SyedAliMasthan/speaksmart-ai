import React from "react";
import ReactDOM from "react-dom/client";
import CoachApp from "./coach/App";
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("/sw.js").catch(() => {}),
  );
}
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <CoachApp />
  </React.StrictMode>,
);
