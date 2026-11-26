// Axios joins a service base path with its route, even when the route starts
// with a slash. Response and proof checks must use the same path.
export function serviceRequestUrl(baseURL: string, route: string): URL {
  return new URL(`${baseURL.replace(/\/+$/, '')}/${route.replace(/^\/+/, '')}`);
}

export function isSameServiceBaseURL(
  left: string | undefined,
  right: string | undefined,
): boolean {
  if (left === right) return true;
  if (!left || !right) return false;
  try {
    const normalize = (value: string) => {
      const url = new URL(value);
      url.pathname = url.pathname.replace(/\/+$/, '');
      return url.href;
    };
    return normalize(left) === normalize(right);
  } catch {
    return false;
  }
}
