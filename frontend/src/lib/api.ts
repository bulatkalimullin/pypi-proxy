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
  };
  releases?: Record<string, unknown[]>;
};

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

