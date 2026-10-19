// The extension's background relays privacy-chain node requests (the
// offscreen runtime's own fetch obeys CORS, and monerod sends none). It can
// reach a node only with host permission for that origin, which the manifest
// declares as optional so the prompt comes when the user picks the node.
//
// Must be called from the click handler, before any other await: the browser
// grants the prompt only inside a user gesture.
export async function requestNodeHostPermission(
  nodeUrl: string,
): Promise<boolean> {
  let origin: string;
  try {
    origin = new URL(nodeUrl).origin;
  } catch {
    return false;
  }
  // Resolves true without prompting when already granted; awaiting anything
  // first would spend the gesture.
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
