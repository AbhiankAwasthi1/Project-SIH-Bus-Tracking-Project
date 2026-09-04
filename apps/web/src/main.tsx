import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { installApiAuthBridge } from "./auth/session";
import "./index.css";

// Registered before the first render so no provider can issue a request before
// the HTTP client knows how to attach the bearer token.
installApiAuthBridge();

const container = document.getElementById("root");
if (!container) {
  throw new Error('Drishti could not start: no element with id "root" in the document.');
}

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
