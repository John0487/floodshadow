import React from "react";
import { createRoot } from "react-dom/client";
import App from "./city/RainApp.jsx";
import "./style.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "./responsive.css";
import "./science.css";
createRoot(document.getElementById("root")).render(<App />);
