import { useCallback, useEffect, useRef, useState } from 'react';

import { useReducedMotion } from 'react-native-reanimated';

// The gap between the cards ($4)
const CARD_SCROLL_MARGIN_TOP = 16;
// The scroll to a card counts as done once the card has held still this
// many frames where the scroll was taking it. Time alone can't tell: a long
// first render holds the smooth scroll back past any short wait
const SETTLE_FRAMES = 4;
// A scroll that never gets there (the page reflowed under it) flashes anyway
const SETTLE_TIMEOUT_MS = 2000;
// The card's header lights up a step for about 600 ms in all: 150 ms in,
// held, 150 ms back
const HEADER_FLASH_MS = 450;
// A request from another page waits this long for its cards to load
const FOCUS_REQUEST_TTL_MS = 10_000;
// A shut group opens over 250 ms (getListHeightTransition): the scroll to it
// waits for the room its cards take
const OPEN_FOLD_MS = 260;

const NO_KEYS: ReadonlySet<string> = new Set();

function findScrollParent(node: HTMLElement): HTMLElement | null {
  let parent = node.parentElement;
  while (parent) {
    const { overflowY } = getComputedStyle(parent);
    if (overflowY === 'auto' || overflowY === 'scroll') {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

// The card's top at the page's top, its gap above it; or as near as the page
// goes, the last cards stopping short with the page at its end
function isAtScrollTarget(node: HTMLElement, scroller: HTMLElement) {
  const offset =
    node.getBoundingClientRect().top -
    scroller.getBoundingClientRect().top -
    CARD_SCROLL_MARGIN_TOP;
  if (Math.abs(offset) < 2) {
    return true;
  }
  if (offset > 0) {
    return (
      scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1
    );
  }
  return scroller.scrollTop <= 0;
}

/**
 * My portfolio's way to a card (web): opens the cards, scrolls the page to
 * the first, leaving the cards' gap above it, focuses it and lights its
 * header once the page stops. Where the page can't bring it to the top (the
 * last cards), the flash still shows which they are. The wide layout's
 * tiles and the home's requests use it, and the phone layout's requests
 */
export function useCardFocus({
  isOpen,
  open,
}: {
  isOpen: (key: string) => boolean;
  open: (key: string) => void;
}) {
  const reduceMotion = useReducedMotion();
  const anchorsRef = useRef(new Map<string, HTMLElement>());
  // The cards scrolled to, marked once the page stops
  const [flashKeys, setFlashKeys] = useState<ReadonlySet<string>>(NO_KEYS);
  const cleanupRef = useRef<(() => void) | undefined>(undefined);
  useEffect(() => () => cleanupRef.current?.(), []);
  const flashWhenSettled = useCallback((keys: string[], node: HTMLElement) => {
    const scroller = findScrollParent(node);
    const startedAt = Date.now();
    let lastTop = Number.NaN;
    let stillFrames = 0;
    let frame: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const watch = () => {
      const top = node.getBoundingClientRect().top;
      stillFrames = Math.abs(top - lastTop) < 0.5 ? stillFrames + 1 : 0;
      lastTop = top;
      const isThere = !scroller || isAtScrollTarget(node, scroller);
      if (
        (isThere && stillFrames >= SETTLE_FRAMES) ||
        Date.now() - startedAt > SETTLE_TIMEOUT_MS
      ) {
        frame = undefined;
        setFlashKeys(new Set(keys));
        timer = setTimeout(() => setFlashKeys(NO_KEYS), HEADER_FLASH_MS);
        return;
      }
      frame = requestAnimationFrame(watch);
    };
    frame = requestAnimationFrame(watch);
    return () => {
      if (frame !== undefined) {
        cancelAnimationFrame(frame);
      }
      clearTimeout(timer);
    };
  }, []);

  const registerAnchor = useCallback(
    (key: string, node: HTMLElement | null) => {
      if (node) {
        anchorsRef.current.set(key, node);
      } else {
        anchorsRef.current.delete(key);
      }
    },
    [],
  );

  const scrollToCards = useCallback(
    (keys: string[]) => {
      const node = keys.length ? anchorsRef.current.get(keys[0]) : undefined;
      if (!node || typeof node.scrollIntoView !== 'function') {
        return false;
      }
      cleanupRef.current?.();
      setFlashKeys(NO_KEYS);
      // A shut card opens first: its own cards are the room the page needs
      // to bring it to the top
      const waitsForFold = !reduceMotion && keys.some((key) => !isOpen(key));
      keys.forEach((key) => open(key));
      let stopFlash: (() => void) | undefined;
      const scroll = () => {
        node.style.scrollMarginTop = `${CARD_SCROLL_MARGIN_TOP}px`;
        node.scrollIntoView({
          behavior: reduceMotion ? 'auto' : 'smooth',
          block: 'start',
        });
        // Focus goes to the card, so Tab goes on from there (its header
        // next) and not from what was pressed, which may be on a page under
        // this one. The card takes it without a ring; the header's flash
        // marks it
        node.tabIndex = -1;
        node.style.outline = 'none';
        node.focus({ preventScroll: true });
        stopFlash = flashWhenSettled(keys, node);
      };
      const timer = waitsForFold ? setTimeout(scroll, OPEN_FOLD_MS) : undefined;
      if (!waitsForFold) {
        scroll();
      }
      cleanupRef.current = () => {
        clearTimeout(timer);
        stopFlash?.();
      };
      return true;
    },
    [flashWhenSettled, isOpen, open, reduceMotion],
  );

  return { flashKeys, registerAnchor, scrollToCards };
}

/**
 * Runs a request another page made (the home's split, a Your loans card)
 * once its cards are in: `run` says whether it found them. A request older
 * than its time is dropped, and each runs once
 */
export function useFocusRequestOnce<T extends { at: number }>(
  request: T | undefined,
  run: (request: T) => boolean,
) {
  const doneAtRef = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (
      !request ||
      doneAtRef.current === request.at ||
      Date.now() - request.at > FOCUS_REQUEST_TTL_MS
    ) {
      return;
    }
    if (run(request)) {
      doneAtRef.current = request.at;
    }
  }, [request, run]);
}
