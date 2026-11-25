export type IMultiQrCoordinateSpace = 'view' | 'frame';

export type IMultiQrSymbolBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type IMultiQrSymbol = {
  text: string;
  centerX: number;
  centerY: number;
  bounds?: IMultiQrSymbolBounds;
};

export type IMultiQrRgbaFrame = {
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

export type IMultiQrFrameEvent = {
  symbols: IMultiQrSymbol[];
  coordinateSpace: IMultiQrCoordinateSpace;
  frameWidth?: number;
  frameHeight?: number;
  frame?: IMultiQrRgbaFrame;
};

export type IMultiQrImageResult = {
  width: number;
  height: number;
  symbols: IMultiQrSymbol[];
  partial?: boolean;
};

export type IPoint2D = {
  x: number;
  y: number;
};

export type IDimensions2D = {
  width: number;
  height: number;
};

const UR_PREFIX = /^ur:/i;
const MULTIPART_UR_PATTERN = /^ur:([a-z0-9-]+)\/(\d+)-(\d+)\/([a-z]+)$/i;

export function isUrFrameText(text: string): boolean {
  return UR_PREFIX.test(text.trim());
}

export function classifyMultiQrLabel(text: string): string {
  const trimmed = text.trim();
  if (isUrFrameText(trimmed)) return 'Hardware UR';
  if (/^wc:/i.test(trimmed)) return 'WalletConnect';
  if (/^ethereum:/i.test(trimmed)) return 'Ethereum';
  if (/^bitcoin:/i.test(trimmed)) return 'Bitcoin';
  if (/^solana:/i.test(trimmed)) return 'Solana';
  if (/^onekey:/i.test(trimmed)) return 'OneKey';
  return 'QR Code';
}

export function mapFramePointToCoverView(
  point: IPoint2D,
  frame: IDimensions2D,
  view: IDimensions2D,
  mirrored = false,
): IPoint2D {
  if (
    frame.width <= 0 ||
    frame.height <= 0 ||
    view.width <= 0 ||
    view.height <= 0
  ) {
    return { x: mirrored ? 1 - point.x : point.x, y: point.y };
  }
  const scale = Math.max(view.width / frame.width, view.height / frame.height);
  const renderedWidth = frame.width * scale;
  const renderedHeight = frame.height * scale;
  const offsetX = (renderedWidth - view.width) / 2;
  const offsetY = (renderedHeight - view.height) / 2;

  const rawX = (point.x * renderedWidth - offsetX) / view.width;
  const rawY = (point.y * renderedHeight - offsetY) / view.height;
  return {
    x: mirrored ? 1 - rawX : rawX,
    y: rawY,
  };
}

export function mapImagePointToContainView(
  point: IPoint2D,
  image: IDimensions2D,
  view: IDimensions2D,
): IPoint2D {
  if (
    image.width <= 0 ||
    image.height <= 0 ||
    view.width <= 0 ||
    view.height <= 0
  ) {
    return point;
  }
  const scale = Math.min(view.width / image.width, view.height / image.height);
  const renderedWidth = image.width * scale;
  const renderedHeight = image.height * scale;
  const offsetX = (view.width - renderedWidth) / 2;
  const offsetY = (view.height - renderedHeight) / 2;

  return {
    x: (offsetX + point.x * renderedWidth) / view.width,
    y: (offsetY + point.y * renderedHeight) / view.height,
  };
}

export function dedupeSymbolsByText(
  symbols: readonly IMultiQrSymbol[],
): IMultiQrSymbol[] {
  const byText = new Map<string, IMultiQrSymbol>();
  for (const symbol of symbols) {
    const key = symbol.text;
    if (key) {
      const existing = byText.get(key);
      if (!existing) {
        byText.set(key, symbol);
      } else {
        const existingDist = Math.hypot(
          existing.centerX - 0.5,
          existing.centerY - 0.5,
        );
        const nextDist = Math.hypot(symbol.centerX - 0.5, symbol.centerY - 0.5);
        if (nextDist < existingDist) {
          byText.set(key, symbol);
        }
      }
    }
  }
  return Array.from(byText.values());
}

/** Light pairwise repulsion so adjacent dots stay clickable (>= 44pt apart). */
export function resolveRepelledAnchorPositions(
  symbols: readonly IMultiQrSymbol[],
  viewWidth: number,
  viewHeight: number,
  margin = 26,
  minDist = 44,
): { symbol: IMultiQrSymbol; x: number; y: number }[] {
  if (viewWidth <= 0 || viewHeight <= 0) return [];
  const safeMarginX = Math.min(margin, viewWidth / 2);
  const safeMarginY = Math.min(margin, viewHeight / 2);
  const clampX = (v: number) =>
    Math.max(safeMarginX, Math.min(viewWidth - safeMarginX, v));
  const clampY = (v: number) =>
    Math.max(safeMarginY, Math.min(viewHeight - safeMarginY, v));

  const pts = symbols.map((symbol) => ({
    symbol,
    x: clampX(symbol.centerX * viewWidth),
    y: clampY(symbol.centerY * viewHeight),
  }));

  for (let iter = 0; iter < 3; iter += 1) {
    for (let i = 0; i < pts.length; i += 1) {
      for (let j = i + 1; j < pts.length; j += 1) {
        const a = pts[i];
        const b = pts[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.01;
        if (dist < minDist) {
          const push = (minDist - dist) / 2;
          const ux = dx / dist;
          const uy = dy / dist;
          a.x = clampX(a.x - ux * push);
          a.y = clampY(a.y - uy * push);
          b.x = clampX(b.x + ux * push);
          b.y = clampY(b.y + uy * push);
        }
      }
    }
  }
  return pts;
}

function extractMultipartUrKey(text: string): string | null {
  const match = MULTIPART_UR_PATTERN.exec(text.trim());
  if (!match) return null;
  const [, type, seqNumStr, seqLenStr] = match;
  const seqNum = Number(seqNumStr);
  const seqLen = Number(seqLenStr);
  if (
    !type ||
    !Number.isInteger(seqNum) ||
    !Number.isInteger(seqLen) ||
    seqNum < 1 ||
    seqLen < 1
  ) {
    return null;
  }
  return `${type.toLowerCase()}/${seqLen}`;
}

export type IMultiSymbolCommitResult =
  | boolean
  | {
      status: 'progress' | 'complete' | 'ignored' | 'rejected';
      reason?: string;
    };

export type IMultiSymbolPhase =
  | 'normal'
  | 'aggregating'
  | 'selecting'
  | 'ur-streaming'
  | 'resolved';

export type IMultiSymbolCoordinatorOptions = {
  aggregationWindowMs?: number;
  minSpatialSeparation?: number;
  onFrozenChange: (frozen: boolean) => void;
  onMultiSymbolChange: (enabled: boolean) => void;
  onSelectingChange: (symbols: IMultiQrSymbol[]) => void;
  onCommitText: (
    text: string,
    mode: 'static' | 'ur',
  ) => IMultiSymbolCommitResult;
};

export type IMultiSymbolCoordinator = {
  readonly phase: IMultiSymbolPhase;
  receiveFrame(symbols: readonly IMultiQrSymbol[]): void;
  selectSymbol(symbol: IMultiQrSymbol): void;
  cancelSelection(): void;
  reset(): void;
  dispose(): void;
};

function classifyCommitResult(
  result: IMultiSymbolCommitResult,
): 'accepted' | 'duplicate' | 'complete' | 'rejected' | 'ignored' {
  if (result === true) return 'accepted';
  if (result && typeof result === 'object') {
    if (result.status === 'complete') return 'complete';
    if (result.status === 'rejected') return 'rejected';
    if (result.status === 'progress') return 'accepted';
    if (result.status === 'ignored' && result.reason === 'duplicate') {
      return 'duplicate';
    }
    return 'ignored';
  }
  return 'ignored';
}

export function createMultiSymbolCoordinator(
  options: IMultiSymbolCoordinatorOptions,
): IMultiSymbolCoordinator {
  const aggregationWindowMs = options.aggregationWindowMs ?? 140;
  const minSpatialSeparation = options.minSpatialSeparation ?? 0.08;

  let phase: IMultiSymbolPhase = 'normal';
  let pendingSymbol: IMultiQrSymbol | undefined;
  let selectedUrKey: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function clearTimer() {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  }

  function enterSelecting(symbols: IMultiQrSymbol[]) {
    clearTimer();
    pendingSymbol = undefined;
    selectedUrKey = null;
    phase = 'selecting';
    options.onFrozenChange(true);
    options.onSelectingChange(symbols);
  }

  function enterUrStreaming(firstPart: string, keepMultiSymbol: boolean) {
    const outcome = classifyCommitResult(options.onCommitText(firstPart, 'ur'));
    if (outcome === 'ignored') return;
    clearTimer();
    pendingSymbol = undefined;
    if (outcome === 'complete' || outcome === 'rejected') {
      selectedUrKey = null;
      phase = 'resolved';
      options.onSelectingChange([]);
      return;
    }
    selectedUrKey = extractMultipartUrKey(firstPart);
    phase = 'ur-streaming';
    options.onSelectingChange([]);
    options.onFrozenChange(false);
    options.onMultiSymbolChange(keepMultiSymbol);
  }

  function commitStatic(text: string) {
    clearTimer();
    pendingSymbol = undefined;
    selectedUrKey = null;
    phase = 'resolved';
    options.onSelectingChange([]);
    options.onCommitText(text, 'static');
  }

  function isVisible(symbol: IMultiQrSymbol): boolean {
    return (
      symbol.centerX >= 0 &&
      symbol.centerX <= 1 &&
      symbol.centerY >= 0 &&
      symbol.centerY <= 1
    );
  }

  return {
    get phase() {
      return phase;
    },
    receiveFrame(rawSymbols: readonly IMultiQrSymbol[]) {
      if (phase === 'selecting' || phase === 'resolved') return;

      const visible = dedupeSymbolsByText(rawSymbols.filter(isVisible));
      if (visible.length === 0) return;

      if (phase === 'ur-streaming') {
        const urSymbols = visible.filter((item) => {
          if (!isUrFrameText(item.text)) return false;
          if (selectedUrKey === null) return true;
          return extractMultipartUrKey(item.text) === selectedUrKey;
        });
        let boundUrVisible = false;
        for (const ur of urSymbols) {
          const outcome = classifyCommitResult(
            options.onCommitText(ur.text, 'ur'),
          );
          if (outcome === 'complete' || outcome === 'rejected') {
            selectedUrKey = null;
            phase = 'resolved';
            return;
          }
          if (outcome === 'accepted' || outcome === 'duplicate') {
            boundUrVisible = true;
          }
        }
        if (!boundUrVisible) {
          options.onMultiSymbolChange(true);
        }
        return;
      }

      if (visible.length >= 2) {
        enterSelecting(visible);
        return;
      }

      const [single] = visible;
      if (!single) return;

      if (isUrFrameText(single.text)) {
        enterUrStreaming(single.text, false);
        return;
      }

      if (phase === 'aggregating' && pendingSymbol) {
        if (single.text !== pendingSymbol.text) {
          const distance = Math.hypot(
            single.centerX - pendingSymbol.centerX,
            single.centerY - pendingSymbol.centerY,
          );
          if (distance > minSpatialSeparation) {
            pendingSymbol = single;
          }
        }
        return;
      }

      if (aggregationWindowMs <= 0) {
        commitStatic(single.text);
        return;
      }

      phase = 'aggregating';
      pendingSymbol = single;
      clearTimer();
      timer = setTimeout(() => {
        timer = undefined;
        if (phase === 'aggregating' && pendingSymbol) {
          commitStatic(pendingSymbol.text);
        }
      }, aggregationWindowMs);
    },
    selectSymbol(symbol: IMultiQrSymbol) {
      if (phase !== 'selecting') return;
      if (isUrFrameText(symbol.text)) {
        if (extractMultipartUrKey(symbol.text) === null) {
          const outcome = classifyCommitResult(
            options.onCommitText(symbol.text, 'ur'),
          );
          if (outcome === 'ignored') return;
          clearTimer();
          pendingSymbol = undefined;
          selectedUrKey = null;
          phase = 'resolved';
          options.onSelectingChange([]);
          return;
        }
        enterUrStreaming(symbol.text, true);
      } else {
        commitStatic(symbol.text);
      }
    },
    cancelSelection() {
      if (phase !== 'selecting') return;
      clearTimer();
      pendingSymbol = undefined;
      selectedUrKey = null;
      phase = 'normal';
      options.onSelectingChange([]);
      options.onFrozenChange(false);
    },
    reset() {
      clearTimer();
      pendingSymbol = undefined;
      selectedUrKey = null;
      phase = 'normal';
      options.onSelectingChange([]);
      options.onFrozenChange(false);
      options.onMultiSymbolChange(true);
    },
    dispose() {
      clearTimer();
      pendingSymbol = undefined;
      selectedUrKey = null;
    },
  };
}
