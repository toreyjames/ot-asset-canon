function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

export function isSupabaseServerConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function supabaseServerFetch(
  path: string,
  init: RequestInit = {}
) {
  const baseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const headers = new Headers(init.headers);
  headers.set("apikey", serviceRoleKey);
  headers.set("Authorization", `Bearer ${serviceRoleKey}`);

  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${baseUrl}/rest/v1/${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Supabase request failed: ${response.status} ${text}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function withPagination(path: string, limit: number, offset: number) {
  const [pathname, queryString = ""] = path.split("?");
  const params = new URLSearchParams(queryString);
  params.set("limit", String(limit));
  params.set("offset", String(offset));
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

export async function supabaseServerFetchAll<T>(
  path: string,
  pageSize = 1000,
  init: RequestInit = {}
): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;

  while (true) {
    const batch = (await supabaseServerFetch(
      withPagination(path, pageSize, offset),
      init
    )) as T[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }

  return rows;
}
