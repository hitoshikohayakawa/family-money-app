function stripKnownSupabasePath(pathname: string) {
  return pathname
    .replace(/\/(?:auth|rest|storage|functions)\/v1\/?$/i, "")
    .replace(/\/+$/g, "");
}

export function normalizeSupabaseUrl(rawUrl: string | undefined | null) {
  if (!rawUrl) {
    return null;
  }

  const trimmedUrl = rawUrl.trim();

  if (!trimmedUrl) {
    return null;
  }

  try {
    const url = new URL(trimmedUrl);
    url.pathname = stripKnownSupabasePath(url.pathname);
    return url.toString().replace(/\/$/, "");
  } catch {
    return trimmedUrl.replace(/\/(?:auth|rest|storage|functions)\/v1\/?$/i, "").replace(/\/+$/g, "");
  }
}
