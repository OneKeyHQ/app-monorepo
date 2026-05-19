import CDP from "chrome-remote-interface";

export interface CdpHandle {
  client: CDP.Client;
  close: () => Promise<void>;
}

/**
 * Attach to the first Hermes / JS target at the given port (Metro's default 8081).
 * Hermes does NOT always tag its target with `vm: Hermes`; we fall back to the
 * first target with type `node` (RN inspector's convention).
 */
export async function attachHermes(port = 8081): Promise<CdpHandle> {
  const targets = await CDP.List({ port });
  const hermes =
    targets.find(
      (t) =>
        /hermes/i.test(t.title ?? "") ||
        (t as unknown as { vm?: string }).vm === "Hermes",
    ) ??
    targets.find((t) => t.type === "node") ??
    targets[0];

  if (!hermes) {
    throw new Error(
      `no CDP target found at http://localhost:${port}/json/list — is Metro running with Hermes?`,
    );
  }

  // Metro doesn't serve /json/protocol; use the locally bundled protocol JSON
  // to avoid CRI's default network fetch failing with HTML 404.
  const client = await CDP({ target: hermes, local: true });
  await client.Runtime.enable();
  return {
    client,
    close: async () => {
      await client.close();
    },
  };
}
