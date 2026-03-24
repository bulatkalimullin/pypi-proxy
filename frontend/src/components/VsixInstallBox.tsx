import React, { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { CodeBlock } from "./CodeBlock";
import { TabBar } from "./TabBar";

type Tab = "one-liner" | "install-id" | "download-vsix" | "install-vsix" | "feed" | "replace-marketplace";
type ModalId =
  | "windows"
  | "macos"
  | "linux"
  | "cursor"
  | "vscodium"
  | "codeserver"
  | "marketplace-guide"
  | "official-vscode";

function baseUrl(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export function VsixInstallBox({
  publisher,
  name,
  version,
}: {
  publisher: string;
  name: string;
  version: string;
}) {
  const [tab, setTab] = useState<Tab>("one-liner");
  const [activeModal, setActiveModal] = useState<ModalId | null>(null);
  const origin = useMemo(() => baseUrl(), []);
  const extensionId = `${publisher}.${name}`;
  const vsixUrl = `${origin}/extensions/vsix/${publisher}/${name}/${version}.vsix`;
  const feedUrl = `${origin}/extensions/feed/index.json`;
  const settingsJson = `{
  "extensions.gallery": {
    "serviceUrl": "${origin}/extensions/feed",
    "itemUrl": "${origin}/extensions"
  }
}`;

  // Close modal on Escape
  useEffect(() => {
    if (!activeModal) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveModal(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeModal]);

  const closeModal = useCallback(() => setActiveModal(null), []);

  const content: Record<Tab, { filename: string; code: string; language: "bash" | "json" }> = {
    "one-liner": {
      filename: "terminal",
      language: "bash",
      code: `curl -sL "${origin}/extensions/install.sh" | bash -s -- ${extensionId}`,
    },
    "install-id": {
      filename: "terminal",
      language: "bash",
      code: `code --install-extension ${extensionId}`,
    },
    "download-vsix": {
      filename: "terminal",
      language: "bash",
      code: `curl -fL "${vsixUrl}" -o "${extensionId}-${version}.vsix"`,
    },
    "install-vsix": {
      filename: "terminal",
      language: "bash",
      code: `code --install-extension "./${extensionId}-${version}.vsix"`,
    },
    feed: {
      filename: "terminal",
      language: "bash",
      code: `curl -s "${feedUrl}" | jq`,
    },
    "replace-marketplace": {
      filename: "settings.json",
      language: "json",
      code: settingsJson,
    },
  };

  const tabs = [
    { key: "one-liner", label: "One-liner" },
    { key: "install-id", label: "CLI" },
    { key: "download-vsix", label: "Download" },
    { key: "install-vsix", label: "Install VSIX" },
    { key: "feed", label: "Feed" },
    { key: "replace-marketplace", label: "Marketplace" },
  ];

  const modalContent: Record<ModalId, { title: string; body: React.ReactNode }> = {
    windows: {
      title: "Windows (PowerShell)",
      body: (
        <CodeBlock
          filename="powershell"
          language="bash"
          content={`# One-liner (requires bash/WSL)
curl -sL "${origin}/extensions/install.sh" | bash -s -- ${extensionId}

# Or native PowerShell:
code --install-extension ${extensionId}

# VSIX fallback
curl.exe -L "${vsixUrl}" -o "${extensionId}-${version}.vsix"
code --install-extension ".\\${extensionId}-${version}.vsix"`}
        />
      ),
    },
    macos: {
      title: "macOS (Terminal)",
      body: (
        <CodeBlock
          filename="terminal"
          language="bash"
          content={`# One-liner
curl -sL "${origin}/extensions/install.sh" | bash -s -- ${extensionId}

# Or manual:
code --install-extension ${extensionId}

# VSIX fallback
curl -fL "${vsixUrl}" -o "${extensionId}-${version}.vsix"
code --install-extension "./${extensionId}-${version}.vsix"`}
        />
      ),
    },
    linux: {
      title: "Linux (Bash)",
      body: (
        <CodeBlock
          filename="terminal"
          language="bash"
          content={`# One-liner
curl -sL "${origin}/extensions/install.sh" | bash -s -- ${extensionId}

# Or manual:
code --install-extension ${extensionId}

# VSIX fallback
wget -O "${extensionId}-${version}.vsix" "${vsixUrl}"
code --install-extension "./${extensionId}-${version}.vsix"`}
        />
      ),
    },
    cursor: {
      title: "Cursor",
      body: (
        <CodeBlock
          filename="terminal"
          language="bash"
          content={`# Cursor CLI (if available in PATH)
cursor --install-extension ${extensionId}

# Fallback via VSIX
curl -fL "${vsixUrl}" -o "${extensionId}-${version}.vsix"
cursor --install-extension "./${extensionId}-${version}.vsix"`}
        />
      ),
    },
    vscodium: {
      title: "VSCodium",
      body: (
        <CodeBlock
          filename="terminal"
          language="bash"
          content={`codium --install-extension ${extensionId}
# or
codium --install-extension "./${extensionId}-${version}.vsix"`}
        />
      ),
    },
    codeserver: {
      title: "code-server",
      body: (
        <CodeBlock
          filename="terminal"
          language="bash"
          content={`code-server --install-extension ${extensionId}
# or
code-server --install-extension "./${extensionId}-${version}.vsix"`}
        />
      ),
    },
    "marketplace-guide": {
      title: "Marketplace override — full guide",
      body: (
        <div className="space-y-3 text-xs text-muted-foreground">
          <p>1) Open Settings (JSON): Command Palette &rarr; Preferences: Open Settings (JSON).</p>
          <p>2) Add this config and save:</p>
          <CodeBlock filename="settings.json" language="json" content={settingsJson} />
          <p>3) Restart your editor completely.</p>
          <p>4) The built-in extension marketplace should now use the Open VSX feed through your proxy.</p>
          <p>5) For CI/automation use the feed endpoint:</p>
          <CodeBlock filename="terminal" language="bash" content={`curl -s "${feedUrl}" | jq`} />
          <p>For VSCodium/Cursor/code-server this usually works immediately. For official VS Code some Marketplace scenarios may be restricted by Microsoft policy — use VSIX fallback.</p>
        </div>
      ),
    },
    "official-vscode": {
      title: "Official VS Code: product.json patch",
      body: (
        <div className="space-y-3 text-xs text-muted-foreground">
          <p>For official VS Code, settings.json alone may not be enough. You need to patch <code className="font-mono bg-muted/60 px-1 rounded">extensionsGallery</code> in <code className="font-mono bg-muted/60 px-1 rounded">product.json</code>.</p>
          <CodeBlock
            filename="product.json patch"
            language="json"
            content={`{
  "extensionsGallery": {
    "serviceUrl": "${origin}/_apis/public/gallery",
    "itemUrl": "${origin}/extensions",
    "controlUrl": "${origin}/extensions/gallery/control",
    "recommendationsUrl": "${origin}/extensions/gallery/recommendations"
  }
}`}
          />
          <p><code className="font-mono bg-muted/60 px-1 rounded">product.json</code> paths:</p>
          <CodeBlock
            filename="paths"
            language="bash"
            content={`# Linux (deb/rpm)
/usr/share/code/resources/app/product.json

# Linux (tar.gz)
<VS_CODE_DIR>/resources/app/product.json

# macOS
/Applications/Visual Studio Code.app/Contents/Resources/app/product.json

# Windows (system)
C:\\Program Files\\Microsoft VS Code\\resources\\app\\product.json

# Windows (user)
%LocalAppData%\\Programs\\Microsoft VS Code\\resources\\app\\product.json`}
          />
          <p>Automated patch script:</p>
          <CodeBlock
            filename="linux-macos-patch.sh"
            language="bash"
            content={`#!/usr/bin/env bash
PRODUCT_JSON="/usr/share/code/resources/app/product.json"

sudo python3 - <<'PY'
import json
from pathlib import Path
p = Path("/usr/share/code/resources/app/product.json")
d = json.loads(p.read_text())
d["extensionsGallery"] = {
  "serviceUrl": "${origin}/_apis/public/gallery",
  "itemUrl": "${origin}/extensions",
  "controlUrl": "${origin}/extensions/gallery/control",
  "recommendationsUrl": "${origin}/extensions/gallery/recommendations"
}
p.write_text(json.dumps(d, ensure_ascii=False, indent=2))
print("patched", p)
PY`}
          />
          <p>After VS Code updates, <code className="font-mono bg-muted/60 px-1 rounded">product.json</code> may get overwritten. Re-apply the patch.</p>
        </div>
      ),
    },
  };

  const osButtons: { id: ModalId; label: string; accent?: boolean }[] = [
    { id: "windows", label: "Windows" },
    { id: "macos", label: "macOS" },
    { id: "linux", label: "Linux" },
    { id: "cursor", label: "Cursor" },
    { id: "vscodium", label: "VSCodium" },
    { id: "codeserver", label: "code-server" },
    { id: "official-vscode", label: "VS Code patch" },
    { id: "marketplace-guide", label: "Full guide", accent: true },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold">Install extension</div>
        <span
          className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: "hsl(var(--eco-vscode)/0.12)", color: "hsl(var(--eco-vscode))" }}
        >
          VS Code
        </span>
      </div>
      <TabBar tabs={tabs} active={tab} onChange={(k) => setTab(k as Tab)} accentColor="hsl(var(--eco-vscode))" layoutId="vscode-install-tab" />
      {tab === "one-liner" && (
        <p className="text-xs text-muted-foreground mt-2">
          No dependencies — auto-detects your editor, downloads and installs VSIX via proxy.
        </p>
      )}
      {tab === "replace-marketplace" && (
        <p className="text-xs text-muted-foreground mt-2">
          Use Open VSX feed through this proxy for built-in marketplace without Sign in.
        </p>
      )}
      <CodeBlock content={content[tab].code} filename={content[tab].filename} language={content[tab].language} />

      <div className="mt-3 space-y-2">
        <div className="text-[11px] text-muted-foreground">OS / Editor guides:</div>
        <div className="flex flex-wrap gap-1.5">
          {osButtons.map((btn) => (
            <button
              key={btn.id}
              onClick={() => setActiveModal(btn.id)}
              className={`text-xs rounded-lg border px-2 py-1 transition-colors ${
                btn.accent
                  ? "border-transparent bg-[hsl(var(--eco-vscode)/0.12)] text-[hsl(var(--eco-vscode))] hover:bg-[hsl(var(--eco-vscode)/0.2)]"
                  : "border-border hover:bg-muted/40"
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {activeModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={closeModal} />
            {/* Content */}
            <motion.div
              className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-background p-4 shadow-lg"
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.15 }}
            >
              <div className="flex items-center justify-between gap-3 mb-3">
                <h3 className="text-sm font-semibold">{modalContent[activeModal].title}</h3>
                <button
                  onClick={closeModal}
                  className="text-xs rounded-lg border border-border px-2 py-1 hover:bg-muted/40 transition-colors flex-shrink-0"
                >
                  Close <span className="text-muted-foreground ml-1">Esc</span>
                </button>
              </div>
              {modalContent[activeModal].body}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
