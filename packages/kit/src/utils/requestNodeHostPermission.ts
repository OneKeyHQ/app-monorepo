// Only the extension needs this: its background relays privacy-chain node
// requests and may reach an origin only with the user's host permission.
export async function requestNodeHostPermission(
  _nodeUrl: string,
): Promise<boolean> {
  return true;
}

export async function releaseNodeHostPermission(
  _nodeUrl: string,
  _remainingNodeUrls: string[],
): Promise<void> {
  // Nothing to give back outside the extension.
}
