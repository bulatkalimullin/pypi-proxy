import React, { useMemo } from "react";
import { Button } from "./ui/button";

function publicBaseUrl(): string {
  // Use current origin host, but backend is on 8888.
  const u = new URL(window.location.href);
  u.port = "8888";
  u.pathname = "";
  u.search = "";
  u.hash = "";
  return u.toString().replace(/\/$/, "");
}

function trustedHost(): string {
  return new URL(publicBaseUrl()).hostname;
}

export function PipInstallBox({ packageName }: { packageName: string }) {
  const cmd = useMemo(() => {
    const base = publicBaseUrl();
    const host = trustedHost();
    return `pip install --index-url ${base}/simple --trusted-host ${host} ${packageName}`;
  }, [packageName]);

  return (
    <div className="rounded-2xl border border-border bg-card/40 p-4">
      <div className="text-sm font-medium">Install via your server</div>
      <div className="mt-1 text-xs text-muted-foreground">Uses PEP 503 /simple and server-side caching.</div>
      <pre className="mt-3 overflow-auto rounded-xl border border-border bg-background p-3 text-xs text-foreground">
        {cmd}
      </pre>
      <div className="mt-3 flex gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            void navigator.clipboard.writeText(cmd);
          }}
        >
          Copy
        </Button>
        <a className="text-sm text-muted-foreground hover:text-foreground" href={`${publicBaseUrl()}/simple/`} target="_blank" rel="noreferrer">
          Open /simple →
        </a>
      </div>
    </div>
  );
}

