import { attachHermes, type CdpHandle } from "../adapters/cdp.js";
import { injectBootstrap } from "../adapters/cdpBootstrap.js";
import type { Registry } from "../daemon/registry.js";

const handles = new Map<string, CdpHandle>();

async function ensureCdp(sessionId: string, port?: number): Promise<CdpHandle> {
  let h = handles.get(sessionId);
  if (!h) {
    h = await attachHermes(port);
    handles.set(sessionId, h);
    // Best-effort bootstrap: inject `__onekey_debug__` probe so later
    // js.eval calls can read store / queryClient / navigation. Runs once
    // per session. Bootstrap failures are non-fatal — callers can inspect
    // `__onekey_debug__.error` to see what happened.
    try {
      await injectBootstrap(h.client);
    } catch {
      // Swallow — bootstrap script catches internally; this guards against
      // unexpected CDP/transport-level rejections.
    }
  }
  return h;
}

/** Tear down a session's CDP handle. Called on session detach (future wiring). */
export async function closeCdpForSession(sessionId: string): Promise<void> {
  const h = handles.get(sessionId);
  if (h) {
    handles.delete(sessionId);
    await h.close();
  }
}

export interface JsEvalParams {
  sessionId: string;
  expression: string;
  returnByValue?: boolean;
  awaitPromise?: boolean;
  port?: number; // metro port override
}

export interface JsEvalResult {
  value?: unknown;
  type?: string;
  error?: unknown;
}

export async function jsEval(
  registry: Registry,
  params: JsEvalParams,
): Promise<JsEvalResult> {
  // Verify session exists — throws -32004 if not.
  registry.get(params.sessionId);

  const h = await ensureCdp(params.sessionId, params.port);
  // Note: chrome-remote-interface types `Runtime.evaluate` as accepting these
  // fields. The cast keeps strict TS happy across CRI's evolving types.
  const r = (await h.client.Runtime.evaluate({
    expression: params.expression,
    returnByValue: params.returnByValue ?? true,
    awaitPromise: params.awaitPromise ?? true,
  })) as {
    result: { value?: unknown; type?: string };
    exceptionDetails?: unknown;
  };

  if (r.exceptionDetails) return { error: r.exceptionDetails };
  return { value: r.result.value, type: r.result.type };
}
