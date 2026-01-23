import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { FloatingLyricsApp } from "./components/FloatingLyricsApp";
import "./index.css";

const isLyricsWindow = window.location.search.includes('window=lyrics');

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isLyricsWindow ? <FloatingLyricsApp /> : <App />}
  </React.StrictMode>,
);
