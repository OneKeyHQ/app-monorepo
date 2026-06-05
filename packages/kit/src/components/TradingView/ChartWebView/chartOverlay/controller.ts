import type { IWebViewRef } from '../../../WebView/types';
import type { ICustomReceiveHandlerData } from '../../TradingViewV2/types';

/**
 * Desktop chart overlay controller.
 *
 * Plays the role native gets for free from the chart-webview module's singleton
 * pool: one warm chart WebView is shared across the whole app (market + perps),
 * and the currently focused chart host "owns" it. On desktop a React unmount
 * destroys an <webview>, so we keep ONE persistent <webview> mounted at the app
 * root (ChartOverlayRoot) and route every focused host through this controller.
 *
 * - Hosts (ChartWebView.desktop) register on focus and report a placeholder rect
 *   so the root can position the shared webview over them.
 * - The root attaches the real webview's ref + forwards its inbound messages.
 * - Inbound chart messages are dispatched to the active host's receive handler.
 * - Symbol switching rides SYMBOL_CHANGE (no reload), exactly like native unified.
 */

export interface IChartOverlayRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface IChartOverlayHost {
  id: string;
  // Measure the host's on-screen placeholder (viewport coords) or null if gone.
  getRect: () => IChartOverlayRect | null;
  // The host's inbound message handler (per-token TradingView handler).
  receive: (data: ICustomReceiveHandlerData) => void;
  // Current TradingView params (symbol/type/decimal/networkId/address/...).
  getParams: () => Record<string, string>;
  // Consumer drives its own SYMBOL_CHANGE (perps) — controller must not auto-send.
  selfDrivenSymbol: boolean;
  // Forwarded to the consumer once the shared page has (re)loaded.
  onLoadEnd?: () => void;
}

// Market tokens route by source-encoded symbol; perps route to Hyperliquid.
// force:false keeps the message idempotent so re-asserting is a no-op when the
// page already shows the symbol. Mirrors the native host's builder.
function buildSymbolChangeMessage(params: Record<string, string>) {
  const source = params.type === 'perps' ? 'hyperliquid' : 'market';
  return {
    type: 'SYMBOL_CHANGE',
    payload: {
      source,
      symbol: params.symbol,
      networkId: params.networkId,
      address: params.address,
      decimal: params.decimal,
      displayPair: params.symbol,
      displayCoin: params.symbol,
      force: false,
    },
  };
}

class ChartOverlayController {
  private hosts = new Map<string, IChartOverlayHost>();

  private activeId: string | null = null;

  // The real shared webview's imperative ref (set by ChartOverlayRoot).
  private webRef: IWebViewRef | null = null;

  // The shared page has finished its (cold) load and its SYMBOL_CHANGE listener
  // is up. Until then symbol sends are buffered via re-assert on load.
  private loaded = false;

  // Root listeners — notified when the active host or visibility changes so the
  // root can show/hide + reposition.
  private listeners = new Set<() => void>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  register(host: IChartOverlayHost): IWebViewRef {
    this.hosts.set(host.id, host);
    // Adapter handed to the host's consumer (TradingView hooks). Sends only land
    // when this host is the active owner of the shared webview.
    return {
      sendMessageViaInjectedScript: (message: unknown) => {
        if (this.activeId !== host.id) return;
        this.webRef?.sendMessageViaInjectedScript(message);
      },
      reload: () => {
        if (this.activeId !== host.id) return;
        this.webRef?.reload();
      },
      loadURL: () => {
        // no-op: the shared page never navigates; symbols ride SYMBOL_CHANGE.
      },
    } as unknown as IWebViewRef;
  }

  unregister(id: string) {
    this.hosts.delete(id);
    if (this.activeId === id) {
      this.activeId = null;
      this.notify();
    }
  }

  setActive(id: string) {
    if (this.activeId === id) return;
    this.activeId = id;
    this.notify();
    // New owner: push its symbol immediately (idempotent) so the shared page
    // shows the right token during the navigation transition.
    this.syncActiveSymbol();
  }

  getActiveId(): string | null {
    return this.activeId;
  }

  getActiveRect(): IChartOverlayRect | null {
    if (!this.activeId) return null;
    return this.hosts.get(this.activeId)?.getRect() ?? null;
  }

  // Called by ChartOverlayRoot when the shared webview ref arrives/changes.
  attachWebView(ref: IWebViewRef | null) {
    this.webRef = ref;
  }

  // Inbound chart message from the shared webview → active host's handler.
  handleMessage(data: ICustomReceiveHandlerData) {
    if (!this.activeId) return;
    this.hosts.get(this.activeId)?.receive(data);
  }

  // Shared page (re)loaded: re-assert the active symbol (its listener may not
  // have been up for the eager send) and forward to the active consumer.
  handleLoaded() {
    this.loaded = true;
    this.syncActiveSymbol();
    if (this.activeId) {
      this.hosts.get(this.activeId)?.onLoadEnd?.();
    }
  }

  // Re-assert the active host's symbol. Idempotent; no-op for self-driven hosts
  // (perps drives a richer SYMBOL_CHANGE itself through the adapter).
  syncActiveSymbol() {
    if (!this.loaded || !this.activeId || !this.webRef) return;
    const host = this.hosts.get(this.activeId);
    if (!host || host.selfDrivenSymbol) return;
    const params = host.getParams();
    if (!params.symbol) return;
    this.webRef.sendMessageViaInjectedScript(buildSymbolChangeMessage(params));
  }
}

export const chartOverlayController = new ChartOverlayController();
