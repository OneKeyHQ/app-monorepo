import { JsonRpcException } from "../shared/jsonRpc.js";
import {
  attachWebViewByTarget,
  forwardAndroidWebView,
  listWebViewPagesAndroid,
  listWebViewPagesIos,
  spawnIWDP,
  type WebViewAttachHandle,
  type WebViewPage,
} from "../adapters/webview.js";
import type { Registry } from "../daemon/registry.js";
import { pickFreePort } from "../shared/freePort.js";

interface SessionWvState {
  iwdpStop?: () => Promise<void>;
  iwdpPort?: number;
  androidUnforward?: () => Promise<void>;
  androidPort?: number;
  attached: Map<string, WebViewAttachHandle>; // targetId -> handle
}

const state = new Map<string, SessionWvState>();

function getOrInit(sessionId: string): SessionWvState {
  let s = state.get(sessionId);
  if (!s) {
    s = { attached: new Map() };
    state.set(sessionId, s);
  }
  return s;
}

export interface WebviewListParams {
  sessionId: string;
  port?: number;
}

export async function webviewList(
  registry: Registry,
  params: WebviewListParams,
): Promise<{ targets: WebViewPage[]; platform: string }> {
  const s = registry.get(params.sessionId);
  const st = getOrInit(params.sessionId);

  if (s.platform === "ios") {
    // Multi-device safety: when the caller doesn't pin a port, reuse the
    // port already spawned for this session, else pick a free one. Two
    // concurrent iOS sessions on the default 27753 would otherwise collide
    // at the iwdp HTTP listener.
    let port = params.port;
    if (!port) {
      port = st.iwdpPort ?? (await pickFreePort());
    }
    if (!st.iwdpStop) {
      try {
        const { stop } = await spawnIWDP(s.deviceId, port);
        st.iwdpStop = stop;
        st.iwdpPort = port;
      } catch (e) {
        // Clean up partial state if spawn aborted mid-way; spawnIWDP throws
        // only after killing its own child, so nothing extra to reap here.
        throw new JsonRpcException(-32010, (e as Error).message);
      }
    }
    const targets = await listWebViewPagesIos(port);
    return { targets, platform: "ios" };
  }

  // android
  if (!st.androidPort) {
    try {
      const { port: p, unforward } = await forwardAndroidWebView(
        s.deviceId,
        s.appBundle,
      );
      st.androidPort = p;
      st.androidUnforward = unforward;
    } catch (e) {
      throw new JsonRpcException(-32010, (e as Error).message);
    }
  }
  const targets = await listWebViewPagesAndroid(st.androidPort!);
  return { targets, platform: "android" };
}

async function ensureAttached(
  sessionId: string,
  target: WebViewPage,
): Promise<WebViewAttachHandle> {
  const st = getOrInit(sessionId);
  let h = st.attached.get(target.id);
  if (!h) {
    h = await attachWebViewByTarget(target);
    st.attached.set(target.id, h);
  }
  return h;
}

async function targetById(
  registry: Registry,
  sessionId: string,
  targetId: string,
): Promise<WebViewPage> {
  const { targets } = await webviewList(registry, { sessionId });
  const t = targets.find((tt) => tt.id === targetId);
  if (!t) {
    throw new JsonRpcException(-32011, `webview target not found: ${targetId}`);
  }
  return t;
}

export interface WebviewEvalParams {
  sessionId: string;
  targetId: string;
  expression: string;
  returnByValue?: boolean;
  awaitPromise?: boolean;
}

export async function webviewEval(
  registry: Registry,
  params: WebviewEvalParams,
): Promise<{ value?: unknown; type?: string; error?: unknown }> {
  const t = await targetById(registry, params.sessionId, params.targetId);
  const h = await ensureAttached(params.sessionId, t);
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

export interface WebviewDomQueryParams {
  sessionId: string;
  targetId: string;
  selector: string;
}

export async function webviewDomQuery(
  registry: Registry,
  params: WebviewDomQueryParams,
): Promise<{ outerHTML: string | null; count: number }> {
  const t = await targetById(registry, params.sessionId, params.targetId);
  const h = await ensureAttached(params.sessionId, t);
  // CDP DOM domain requires DOM.enable
  await h.client.DOM.enable();
  const { root } = (await h.client.DOM.getDocument({
    depth: -1,
    pierce: true,
  })) as { root: { nodeId: number } };
  const nodes = (await h.client.DOM.querySelectorAll({
    nodeId: root.nodeId,
    selector: params.selector,
  })) as { nodeIds: number[] };
  if (nodes.nodeIds.length === 0) return { outerHTML: null, count: 0 };
  const outer = (await h.client.DOM.getOuterHTML({
    nodeId: nodes.nodeIds[0],
  })) as { outerHTML: string };
  return { outerHTML: outer.outerHTML, count: nodes.nodeIds.length };
}

/** Tear down all webview adapters for a session (called on session detach). */
export async function detachWebViewState(sessionId: string): Promise<void> {
  const st = state.get(sessionId);
  if (!st) return;
  for (const h of st.attached.values()) {
    try {
      await h.close();
    } catch {
      // ignore — best-effort cleanup
    }
  }
  if (st.androidUnforward) await st.androidUnforward().catch(() => undefined);
  if (st.iwdpStop) await st.iwdpStop().catch(() => undefined);
  state.delete(sessionId);
}
