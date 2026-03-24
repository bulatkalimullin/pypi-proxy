export type ApiSearchResponse = {
  q: string;
  page: number;
  results: Array<{ name: string }>;
  hasMore?: boolean;
  nextPage?: number | null;
};

export type PyPIPackageJson = {
  info?: {
    name?: string;
    summary?: string;
    version?: string;
    license?: string;
    requires_python?: string;
    description?: string;
    description_content_type?: string;
    author?: string;
    author_email?: string;
    home_page?: string;
    project_url?: string;
    project_urls?: Record<string, string>;
    keywords?: string;
    classifiers?: string[];
    requires_dist?: string[] | null;
  };
  releases?: Record<string, Array<{
    filename?: string;
    url?: string;
    packagetype?: string;
    size?: number;
    upload_time?: string;
  }>>;
};

export type ApiStatsResponse = {
  cached_packages: number;
  cached_files: number;
  cache_size_bytes: number;
  download_counts: Record<string, number>;
  top_downloads: Array<{ name: string; count: number }>;
  uptime_seconds: number;
};

export type ApiCachedResponse = {
  packages: string[];
};

export type NpmSearchResult = {
  name: string;
  version: string;
  description: string;
  keywords: string[];
};

export type NpmSearchResponse = {
  q: string;
  page: number;
  results: NpmSearchResult[];
  hasMore?: boolean;
  nextPage?: number | null;
};

export type NugetSearchResult = {
  id: string;
  version: string;
  description: string;
  authors: string;
  totalDownloads?: number;
};

export type NugetSearchResponse = {
  q: string;
  skip: number;
  take: number;
  totalHits: number;
  results: NugetSearchResult[];
  hasMore: boolean;
};

export type JsHealthResponse = {
  url: string;
  ok: boolean;
  status_code: number | null;
  content_type: string | null;
  checked_at: string;
  message: string | null;
};

export type JsStatsResponse = {
  total_proxy_requests: number;
  unique_urls: number;
  unique_domains: number;
  top_urls: Array<{ url: string; count: number }>;
  top_domains: Array<{ domain: string; count: number }>;
  last_health_checks: Record<
    string,
    {
      ok: boolean;
      status_code: number | null;
      content_type: string | null;
      checked_at: string;
      message: string | null;
    }
  >;
};

const ADMIN_TOKEN_KEY = "admin_token";

export function getAdminToken(): string | null {
  return sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(password: string): void {
  const token = btoa(`:${password}`);
  sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function clearAdminToken(): void {
  sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

function adminHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getAdminToken();
  const headers: Record<string, string> = { ...extra };
  if (token) headers["Authorization"] = `Basic ${token}`;
  return headers;
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(path, { method: "DELETE", headers: adminHeaders() });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
  }
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const headers = adminHeaders(body ? { "Content-Type": "application/json" } : {});
  const res = await fetch(path, {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
  }
  return (await res.json()) as T;
}

export type PyPIVersionJson = {
  info?: {
    name?: string;
    version?: string;
    summary?: string;
    license?: string;
    requires_python?: string;
    requires_dist?: string[] | null;
  };
  urls?: Array<{
    filename?: string;
    url?: string;
    packagetype?: string;
    size?: number;
  }>;
};

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
  }
  return (await res.json()) as T;
}

export function buildJsProxyUrl(targetUrl: string): string {
  return `/js-proxy?url=${encodeURIComponent(targetUrl)}`;
}

export async function getJsHealth(targetUrl: string): Promise<JsHealthResponse> {
  return apiGet<JsHealthResponse>(`/api/js/health?url=${encodeURIComponent(targetUrl)}`);
}

export async function getJsStats(): Promise<JsStatsResponse> {
  return apiGet<JsStatsResponse>("/api/js/stats");
}

