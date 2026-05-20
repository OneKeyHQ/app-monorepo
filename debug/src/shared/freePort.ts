import { createServer } from "node:net";

/**
 * Ask the OS for an ephemeral free TCP port by binding to 0.
 *
 * Callers must use the returned port quickly: between the close() resolving
 * here and the caller binding/forwarding, another process can race in and
 * grab the same port. For our use (per-session iwdp / adb forward setup),
 * the window is small and the failure mode is a friendly retry, so we don't
 * try to hold the port open.
 */
export function pickFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    // Avoid keeping the event loop alive on this throwaway listener.
    server.unref();
    server.on("error", reject);
    server.listen(0, () => {
      const addr = server.address();
      if (typeof addr === "object" && addr !== null) {
        const port = addr.port;
        server.close(() => resolve(port));
      } else {
        server.close();
        reject(new Error("server.address() returned unexpected type"));
      }
    });
  });
}
