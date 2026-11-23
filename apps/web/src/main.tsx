import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./app/App";
import "./styles/base.css";
import "./styles/christmas.css";
import "./styles/responsive.css";
import "./styles/palette.css";
import "./styles/brand.css";
import "./styles/friendmas.css";
import "./styles/gift-jar.css";
import "./styles/motion.css";
createRoot(document.getElementById("root")!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
