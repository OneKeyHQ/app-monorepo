export function isTrustedDesktopApiRendererUrl({
  candidateUrl,
  trustedEntryUrl,
}: {
  candidateUrl: string;
  trustedEntryUrl: string;
}): boolean {
  try {
    const candidate = new URL(candidateUrl);
    const trustedEntry = new URL(trustedEntryUrl);
    if (candidate.protocol !== trustedEntry.protocol) {
      return false;
    }
    if (trustedEntry.protocol === 'file:') {
      return (
        candidate.hostname === trustedEntry.hostname &&
        candidate.pathname === trustedEntry.pathname
      );
    }
    return candidate.origin === trustedEntry.origin;
  } catch {
    return false;
  }
}
