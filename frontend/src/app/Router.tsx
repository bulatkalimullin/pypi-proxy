import React, { Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "../components/AppShell";

const SearchPage = React.lazy(() => import("../pages/SearchPage"));
const PackagePage = React.lazy(() => import("../pages/PackagePage"));
const VersionPage = React.lazy(() => import("../pages/VersionPage"));

function PageFallback() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="h-6 w-40 rounded bg-muted animate-pulse" />
      <div className="mt-4 h-10 w-full rounded bg-muted animate-pulse" />
      <div className="mt-6 grid gap-3">
        <div className="h-20 rounded bg-muted animate-pulse" />
        <div className="h-20 rounded bg-muted animate-pulse" />
        <div className="h-20 rounded bg-muted animate-pulse" />
      </div>
    </div>
  );
}

export function Router() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<SearchPage />} />
          <Route path="/package/:name" element={<PackagePage />} />
          <Route path="/package/:name/:version" element={<VersionPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

