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
  verifyPreview?: (
    receive: (frame: IMultiQrFrameEvent) => boolean | void,
  ) => Promise<void>;
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
        const dist = Math.hypot(dx, dy);
        if (dist === 0 && viewHeight - 2 * safeMarginY >= minDist) {
          a.y = Math.min(
            clampY(a.y - minDist / 2),
            viewHeight - safeMarginY - minDist,
          );
          b.y = a.y + minDist;
        } else if (dist === 0 && viewWidth - 2 * safeMarginX >= minDist) {
          a.x = Math.min(
            clampX(a.x - minDist / 2),
            viewWidth - safeMarginX - minDist,
          );
          b.x = a.x + minDist;
        } else if (dist > 0 && dist < minDist) {
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
  | 'progress'
  | 'complete'
  | 'duplicate'
  | 'retry'
  | 'ignored';

export type IMultiSymbolPhase =
  | 'normal'
  | 'aggregating'
  | 'verifying'
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
  ) => Promise<IMultiSymbolCommitResult>;
};

export type IMultiSymbolCoordinator = {
  readonly phase: IMultiSymbolPhase;
  needsSelection(symbols: readonly IMultiQrSymbol[]): boolean;
  beginPreviewVerification(): (
    symbols?: readonly IMultiQrSymbol[],
  ) => true | void;
  receiveFrame(symbols: readonly IMultiQrSymbol[]): true | void;
  receiveFastPathText(text: string): void;
  selectSymbol(symbol: IMultiQrSymbol): void;
  cancelSelection(): void;
  reset(): void;
  dispose(): void;
};

export function createMultiSymbolCoordinator(
  options: IMultiSymbolCoordinatorOptions,
): IMultiSymbolCoordinator {
  const aggregationWindowMs = options.aggregationWindowMs ?? 140;
  const minSpatialSeparation = options.minSpatialSeparation ?? 0.08;

  let phase: IMultiSymbolPhase = 'normal';
  let pendingSymbol: IMultiQrSymbol | undefined;
  let selectedUrKey: string | null = null;
  let acceptFastPathText = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pendingCommit: symbol | undefined;
  let previewVerification: symbol | undefined;
  let offered: readonly IMultiQrSymbol[] = [];
  let dismissed: { keys: Set<string>; lastSeen: number } | undefined;

  function selectionKey(symbol: IMultiQrSymbol): string {
    return extractMultipartUrKey(symbol.text) ?? symbol.text;
  }

  function matchesDismissed(symbols: readonly IMultiQrSymbol[]): boolean {
    return Boolean(
      dismissed &&
      Date.now() - dismissed.lastSeen <= 800 &&
      symbols.every((symbol) => dismissed?.keys.has(selectionKey(symbol))),
    );
  }

  function closeSelection() {
    options.onSelectingChange([]);
    options.onFrozenChange(false);
  }

  function resumeScanning() {
    phase = 'normal';
    acceptFastPathText = false;
    selectedUrKey = null;
    closeSelection();
    options.onMultiSymbolChange(true);
  }

  function dismissOffered() {
    if (offered.length > 0) {
      dismissed = {
        keys: new Set(offered.map(selectionKey)),
        lastSeen: Date.now(),
      };
      offered = [];
    }
  }

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
    offered = symbols;
    options.onFrozenChange(true);
    options.onSelectingChange(symbols);
  }

  function submitUrPart(
    texts: readonly string[],
    starting: boolean,
    keepMultiSymbol: boolean,
  ) {
    if (pendingCommit) return;
    const wasSelecting = phase === 'selecting';
    if (starting && !wasSelecting) {
      clearTimer();
      pendingSymbol = undefined;
      phase = 'ur-streaming';
      acceptFastPathText = true;
      options.onMultiSymbolChange(false);
    }

    const request = Symbol('UR commit');
    pendingCommit = request;
    const result = (async (): Promise<IMultiSymbolCommitResult> => {
      for (const text of texts) {
        const outcome = await options
          .onCommitText(text, 'ur')
          .catch(() => 'ignored' as const);
        if (pendingCommit !== request) return 'ignored';
        if (outcome !== 'ignored' && outcome !== 'duplicate') return outcome;
      }
      return 'ignored';
    })();
    void result.then((outcome) => {
      if (pendingCommit !== request) return;
      pendingCommit = undefined;

      if (outcome === 'complete') {
        dismissOffered();
        resumeScanning();
      } else if (outcome === 'progress' && starting) {
        selectedUrKey = extractMultipartUrKey(texts[0]);
        acceptFastPathText = !keepMultiSymbol;
        phase = 'ur-streaming';
        closeSelection();
        options.onMultiSymbolChange(keepMultiSymbol);
      } else if (starting && !wasSelecting && outcome !== 'progress') {
        resumeScanning();
      }
    });
  }

  function commitStatic(text: string) {
    if (phase === 'selecting') options.onFrozenChange(false);
    clearTimer();
    pendingSymbol = undefined;
    selectedUrKey = null;
    phase = 'resolved';
    options.onSelectingChange([]);
    const request = Symbol('static commit');
    pendingCommit = request;
    const result = options
      .onCommitText(text, 'static')
      .catch(() => 'ignored' as const);
    void result.then((outcome) => {
      if (pendingCommit !== request) return;
      pendingCommit = undefined;
      if (outcome === 'retry') {
        offered = [];
        resumeScanning();
      }
    });
  }

  function isVisible(symbol: IMultiQrSymbol): boolean {
    return (
      symbol.centerX >= 0 &&
      symbol.centerX <= 1 &&
      symbol.centerY >= 0 &&
      symbol.centerY <= 1
    );
  }

  function matchesSelectedUr(text: string): boolean {
    return (
      isUrFrameText(text) &&
      (selectedUrKey === null || extractMultipartUrKey(text) === selectedUrKey)
    );
  }

  return {
    get phase() {
      return phase;
    },
    receiveFastPathText(text) {
      if (
        phase === 'ur-streaming' &&
        acceptFastPathText &&
        matchesSelectedUr(text)
      ) {
        submitUrPart([text], false, false);
      }
    },
    needsSelection(symbols) {
      return (
        (phase === 'normal' || phase === 'aggregating') &&
        dedupeSymbolsByText(symbols.filter(isVisible)).length >= 2 &&
        !matchesDismissed(symbols.filter(isVisible))
      );
    },
    beginPreviewVerification() {
      clearTimer();
      pendingSymbol = undefined;
      phase = 'verifying';
      const verification = Symbol('desktop preview verification');
      previewVerification = verification;
      return (symbols) => {
        if (previewVerification !== verification) return;
        previewVerification = undefined;
        const visible = dedupeSymbolsByText((symbols ?? []).filter(isVisible));
        if (visible.length >= 2 && !matchesDismissed(visible)) {
          enterSelecting(visible);
          return true;
        }
        phase = 'normal';
      };
    },
    receiveFrame(rawSymbols: readonly IMultiQrSymbol[]) {
      if (
        phase === 'verifying' ||
        phase === 'selecting' ||
        phase === 'resolved'
      )
        return;

      const visible = dedupeSymbolsByText(rawSymbols.filter(isVisible));
      if (visible.length === 0) return;

      if (phase === 'ur-streaming') {
        if (pendingCommit) return;
        const candidates = visible
          .map((item) => item.text)
          .filter(matchesSelectedUr);
        if (candidates.length) {
          submitUrPart(candidates, false, !acceptFastPathText);
        } else {
          acceptFastPathText = false;
          options.onMultiSymbolChange(true);
        }
        return;
      }

      if (matchesDismissed(visible) && dismissed) {
        dismissed.lastSeen = Date.now();
        return;
      }
      dismissed = undefined;

      if (visible.length >= 2) {
        enterSelecting(visible);
        return true;
      }

      const [single] = visible;
      if (!single) return;

      if (isUrFrameText(single.text)) {
        submitUrPart([single.text], true, false);
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
      if (pendingCommit) return;
      if (isUrFrameText(symbol.text)) {
        submitUrPart([symbol.text], true, true);
      } else {
        commitStatic(symbol.text);
      }
    },
    cancelSelection() {
      if (phase !== 'selecting' || pendingCommit) return;
      dismissOffered();
      resumeScanning();
    },
    reset() {
      clearTimer();
      pendingSymbol = undefined;
      pendingCommit = undefined;
      previewVerification = undefined;
      dismissed = undefined;
      offered = [];
      resumeScanning();
    },
    dispose() {
      clearTimer();
      pendingSymbol = undefined;
      pendingCommit = undefined;
      previewVerification = undefined;
    },
  };
}
