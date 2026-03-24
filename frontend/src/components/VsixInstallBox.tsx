import React, { useMemo, useState } from "react";

import { CodeBlock } from "./CodeBlock";
import { TabBar } from "./TabBar";

type Tab = "install-id" | "download-vsix" | "install-vsix" | "feed" | "replace-marketplace";
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
  const [tab, setTab] = useState<Tab>("install-id");
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

  const content: Record<Tab, { filename: string; code: string; language: "bash" | "json" }> = {
    "install-id": {
      filename: "terminal",
      language: "bash",
      code: `code --install-extension ${extensionId}`,
    },
    "download-vsix": {
      filename: "terminal",
      language: "bash",
      code: `curl -L "${vsixUrl}" -o "${extensionId}-${version}.vsix"`,
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
    { key: "install-id", label: "Install by ID" },
    { key: "download-vsix", label: "Download VSIX" },
    { key: "install-vsix", label: "Install VSIX" },
    { key: "feed", label: "Feed API" },
    { key: "replace-marketplace", label: "Marketplace override" },
  ];

  const modalContent: Record<ModalId, { title: string; body: React.ReactNode }> = {
    windows: {
      title: "Windows (PowerShell)",
      body: (
        <CodeBlock
          filename="powershell"
          language="bash"
          content={`# Install by extension id
code --install-extension ${extensionId}

# VSIX flow
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
          content={`# Install by extension id
code --install-extension ${extensionId}

# VSIX flow
curl -L "${vsixUrl}" -o "${extensionId}-${version}.vsix"
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
          content={`# Install by extension id
code --install-extension ${extensionId}

# VSIX flow
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
curl -L "${vsixUrl}" -o "${extensionId}-${version}.vsix"`}
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
      title: "Полная инструкция: встроенная установка без Sign in",
      body: (
        <div className="space-y-3 text-xs text-muted-foreground">
          <p>1) Откройте Settings (JSON) в редакторе: Command Palette -&gt; Preferences: Open Settings (JSON).</p>
          <p>2) Добавьте конфигурацию ниже и сохраните файл:</p>
          <CodeBlock filename="settings.json" language="json" content={settingsJson} />
          <p>3) Полностью перезапустите VS Code/совместимый клиент.</p>
          <p>4) Проверьте поиск/установку: встроенный магазин должен использовать Open VSX feed через ваш proxy, без Sign in.</p>
          <p>5) Для CI/автоматизации используйте endpoint:</p>
          <CodeBlock filename="terminal" language="bash" content={`curl -s "${feedUrl}" | jq`} />
          <p>Для VSCodium/Cursor/code-server это обычно работает сразу. Для официального VS Code часть сценариев Marketplace может быть ограничена политикой Microsoft, тогда используйте VSIX fallback.</p>
        </div>
      ),
    },
    "official-vscode": {
      title: "Official VS Code: patch for Linux/macOS/Windows",
      body: (
        <div className="space-y-3 text-xs text-muted-foreground">
          <p>Для official VS Code одного settings.json часто недостаточно. Нужно патчить <code className="font-mono">extensionsGallery</code> в <code className="font-mono">product.json</code>.</p>
          <p>Минимальный patch (одинаковый для всех ОС):</p>
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
          <p>Пути к <code className="font-mono">product.json</code>:</p>
          <CodeBlock
            filename="paths"
            language="bash"
            content={`# Linux (deb/rpm)
/usr/share/code/resources/app/product.json

# Linux (tar.gz, user install)
<VS_CODE_DIR>/resources/app/product.json

# macOS
/Applications/Visual Studio Code.app/Contents/Resources/app/product.json

# Windows (system install)
C:\\Program Files\\Microsoft VS Code\\resources\\app\\product.json

# Windows (user install)
%LocalAppData%\\Programs\\Microsoft VS Code\\resources\\app\\product.json`}
          />
          <p>Патч-команды для каждой ОС:</p>
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
          <CodeBlock
            filename="windows-patch.ps1"
            language="bash"
            content={`$ProductJson = "$env:LOCALAPPDATA\\Programs\\Microsoft VS Code\\resources\\app\\product.json"
if (!(Test-Path $ProductJson)) {
  $ProductJson = "C:\\Program Files\\Microsoft VS Code\\resources\\app\\product.json"
}
$json = Get-Content $ProductJson -Raw | ConvertFrom-Json
$json.extensionsGallery = @{
  serviceUrl = "${origin}/_apis/public/gallery"
  itemUrl = "${origin}/extensions"
  controlUrl = "${origin}/extensions/gallery/control"
  recommendationsUrl = "${origin}/extensions/gallery/recommendations"
}
$json | ConvertTo-Json -Depth 100 | Set-Content $ProductJson -Encoding UTF8
Write-Host "patched $ProductJson"`}
          />
          <p>После обновления VS Code <code className="font-mono">product.json</code> может перезаписываться. Пере-применяйте patch (через post-update script/task scheduler).</p>
          <p>Права: Linux/macOS — обычно нужен <code className="font-mono">sudo</code>, Windows — PowerShell от администратора для system install.</p>
          <p>Проверка: откройте Extensions и убедитесь, что больше нет обращения к Microsoft Marketplace и исчез <code className="font-mono">Sign in</code>.</p>
        </div>
      ),
    },
  };

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold">Install extension</div>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">VS Code</span>
      </div>
      <TabBar tabs={tabs} active={tab} onChange={(k) => setTab(k as Tab)} accentColor="hsl(var(--eco-vscode))" layoutId="vscode-install-tab" />
      {tab === "replace-marketplace" && (
        <p className="text-xs text-muted-foreground mt-2">
          Используйте Open VSX feed через этот proxy: это основной путь, чтобы встроенная установка работала без Sign in.
        </p>
      )}
      <CodeBlock content={content[tab].code} filename={content[tab].filename} language={content[tab].language} />

      <div className="mt-3 space-y-2">
        <div className="text-[11px] text-muted-foreground">Готовые модальные окна по системе/редактору:</div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setActiveModal("windows")} className="text-xs rounded-md border border-border px-2 py-1 hover:bg-muted/40">Windows</button>
          <button onClick={() => setActiveModal("macos")} className="text-xs rounded-md border border-border px-2 py-1 hover:bg-muted/40">macOS</button>
          <button onClick={() => setActiveModal("linux")} className="text-xs rounded-md border border-border px-2 py-1 hover:bg-muted/40">Linux</button>
          <button onClick={() => setActiveModal("cursor")} className="text-xs rounded-md border border-border px-2 py-1 hover:bg-muted/40">Cursor</button>
          <button onClick={() => setActiveModal("vscodium")} className="text-xs rounded-md border border-border px-2 py-1 hover:bg-muted/40">VSCodium</button>
          <button onClick={() => setActiveModal("codeserver")} className="text-xs rounded-md border border-border px-2 py-1 hover:bg-muted/40">code-server</button>
          <button onClick={() => setActiveModal("official-vscode")} className="text-xs rounded-md border border-border px-2 py-1 hover:bg-muted/40">Official VS Code patch</button>
          <button onClick={() => setActiveModal("marketplace-guide")} className="text-xs rounded-md border border-border px-2 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20">Полная инструкция Marketplace</button>
        </div>
      </div>

      {activeModal && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl border border-border bg-background p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="text-sm font-semibold">{modalContent[activeModal].title}</h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-xs rounded-md border border-border px-2 py-1 hover:bg-muted/40"
              >
                Закрыть
              </button>
            </div>
            {modalContent[activeModal].body}
          </div>
        </div>
      )}
    </div>
  );
}
