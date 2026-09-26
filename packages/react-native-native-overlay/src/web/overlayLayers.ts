import {
  OVERLAY_LEVELS,
  OVERLAY_LEVEL_ORDER,
  OVERLAY_WEB_Z_INDEX_BASE,
} from '../OverlayLevels';
import { overlayStore } from '../OverlayStore';

import type { IOverlayRequestDismissReason } from '../OverlayViewTypes';
import type { IOverlayLevel } from '../types';

const LAYER_ATTRIBUTE = 'data-onekey-overlay-layer';
export const ENTRY_ATTRIBUTE = 'data-onekey-overlay-entry';

const APP_ROOT_ID = 'root';

const layerRoots = new Map<IOverlayLevel, HTMLDivElement>();
const dismissRequesters = new Map<
  string,
  (reason: IOverlayRequestDismissReason) => void
>();
let installed = false;

function createLayerRoot(level: IOverlayLevel): HTMLDivElement {
  const root = document.createElement('div');
  root.setAttribute(LAYER_ATTRIBUTE, level);
  Object.assign(root.style, {
    position: 'fixed',
    inset: '0',
    pointerEvents: 'none',
    zIndex: String(OVERLAY_WEB_Z_INDEX_BASE[level]),
    isolation: 'isolate',
  });
  // Keep DOM order equal to level order so equal z-index ties stay correct.
  const next = OVERLAY_LEVELS.slice(OVERLAY_LEVELS.indexOf(level) + 1)
    .map((l) => layerRoots.get(l))
    .find(Boolean);
  document.body.insertBefore(root, next ?? null);
  return root;
}

function setInert(element: HTMLElement | null | undefined, inert: boolean) {
  if (element && element.inert !== inert) {
    element.inert = inert;
  }
}

/** Everything rendered below the topmost blocking entry becomes inert. */
function syncInert() {
  const top = overlayStore.getBlockingTop();
  setInert(document.getElementById(APP_ROOT_ID), !!top);
  for (const [level, root] of layerRoots) {
    const below =
      !!top && OVERLAY_LEVEL_ORDER[level] < OVERLAY_LEVEL_ORDER[top.level];
    setInert(root, below);
    if (top && level === top.level) {
      root
        .querySelectorAll<HTMLElement>(`[${ENTRY_ATTRIBUTE}]`)
        .forEach((node) => {
          setInert(node, Number(node.dataset.stackOrder) < top.seq);
        });
    }
  }
}

function onKeyDown(event: KeyboardEvent) {
  // Escape while composing belongs to the IME.
  if (event.key !== 'Escape' || event.isComposing || event.keyCode === 229) {
    return;
  }
  const resolution = overlayStore.resolveBack();
  if (resolution.kind === 'pass') {
    return;
  }
  event.stopPropagation();
  event.preventDefault();
  if (resolution.kind === 'dismiss') {
    dismissRequesters.get(resolution.id)?.('back');
  }
}

function installOverlayWebManager() {
  if (installed || typeof document === 'undefined') {
    return;
  }
  installed = true;
  overlayStore.subscribe(syncInert);
  document.addEventListener('keydown', onKeyDown, true);
}

export function getOverlayLayerRoot(level: IOverlayLevel): HTMLDivElement {
  installOverlayWebManager();
  let root = layerRoots.get(level);
  if (!root || !root.isConnected) {
    root = createLayerRoot(level);
    layerRoots.set(level, root);
  }
  return root;
}

export function registerOverlayDismissRequester(
  id: string,
  requester: (reason: IOverlayRequestDismissReason) => void,
): () => void {
  dismissRequesters.set(id, requester);
  return () => {
    if (dismissRequesters.get(id) === requester) {
      dismissRequesters.delete(id);
    }
  };
}

/** Re-run after entry DOM nodes mount, since the store emits before commit. */
export function scheduleOverlayInertSync() {
  requestAnimationFrame(syncInert);
}
