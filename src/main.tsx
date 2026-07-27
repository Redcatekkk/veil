import React from "react";
import ReactDOM from "react-dom/client";
import "./fonts.css";
import App from "./App";
import { lockdown } from "./security";

lockdown();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
