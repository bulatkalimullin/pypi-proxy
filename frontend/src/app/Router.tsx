import React, { Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "../components/AppShell";
import { AdminAuthGate } from "../components/AdminAuthGate";

const SearchPage = React.lazy(() => import("../pages/SearchPage"));
const PackagePage = React.lazy(() => import("../pages/PackagePage"));
const VersionPage = React.lazy(() => import("../pages/VersionPage"));
const AdminPage = React.lazy(() => import("../pages/AdminPage"));
const NpmSearchPage = React.lazy(() => import("../pages/NpmSearchPage"));
const NpmPackagePage = React.lazy(() => import("../pages/NpmPackagePage"));
const NugetSearchPage = React.lazy(() => import("../pages/NugetSearchPage"));
const NugetPackagePage = React.lazy(() => import("../pages/NugetPackagePage"));
const DockerSearchPage = React.lazy(() => import("../pages/DockerSearchPage"));
const DockerPackagePage = React.lazy(() => import("../pages/DockerPackagePage"));

function PageFallback() {
  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10">
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
          {/* Python / PyPI */}
          <Route path="/" element={<SearchPage />} />
          <Route path="/package/:name" element={<PackagePage />} />
          <Route path="/package/:name/:version" element={<VersionPage />} />
          {/* npm */}
          <Route path="/npm" element={<NpmSearchPage />} />
          <Route path="/npm/package/*" element={<NpmPackagePage />} />
          {/* NuGet */}
          <Route path="/nuget" element={<NugetSearchPage />} />
          <Route path="/nuget/package/:id" element={<NugetPackagePage />} />
          {/* Docker */}
          <Route path="/docker" element={<DockerSearchPage />} />
          <Route path="/docker/image/*" element={<DockerPackagePage />} />
          {/* Admin */}
          <Route
            path="/admin"
            element={
              <AdminAuthGate>
                <AdminPage />
              </AdminAuthGate>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
