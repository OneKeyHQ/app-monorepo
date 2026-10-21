// The background relays node requests (offscreen fetch obeys CORS, and
// monerod sends no CORS headers), which needs optional host permission.
// Call from the click handler before any other await: the prompt needs the
// user gesture.
export async function requestNodeHostPermission(
  nodeUrl: string,
): Promise<boolean> {
  let origin: string;
  try {
    origin = new URL(nodeUrl).origin;
  } catch {
    return false;
  }
  // Resolves true without prompting when already granted.
  return chrome.permissions.request({ origins: [`${origin}/*`] });
}

// Deleting a node gives back its host permission, unless another configured
// node still lives on that origin.
export async function releaseNodeHostPermission(
  nodeUrl: string,
  remainingNodeUrls: string[],
): Promise<void> {
  let origin: string;
  try {
    origin = new URL(nodeUrl).origin;
  } catch {
    return;
  }
  const stillUsed = remainingNodeUrls.some((url) => {
    try {
      return new URL(url).origin === origin;
    } catch {
      return false;
    }
  });
  if (stillUsed) return;
  await chrome.permissions
    .remove({ origins: [`${origin}/*`] })
    .catch(() => undefined);
}
