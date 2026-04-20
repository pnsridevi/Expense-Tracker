//import react from "react";
import reactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./context/AuthProvider";
import "./index.css";

reactDOM.createRoot(document.getElementById("root")).render(
  <AuthProvider>
    <App />,
  </AuthProvider>,
);
