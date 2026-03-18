import React from "react";
import { BrowserRouter } from "react-router-dom";

import { ThemeProvider } from "../contexts/ThemeContext";
import { ToastProvider } from "../contexts/ToastContext";
import { Router } from "../app/Router";

export function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-background text-foreground">
            <Router />
          </div>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}
