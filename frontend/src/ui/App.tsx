import React from "react";
import { BrowserRouter } from "react-router-dom";

import { Router } from "../app/Router";

export function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background text-foreground">
        <Router />
      </div>
    </BrowserRouter>
  );
}

