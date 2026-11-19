import { memo, useEffect, useRef } from 'react';

import { Easing } from 'react-native-reanimated';

import { Theme, YStack, useTheme } from '@onekeyhq/components';

import {
  EARN_GUIDE_CARD_PB,
  EARN_GUIDE_CARD_RADIUS,
  EARN_GUIDE_INK,
  EARN_GUIDE_INK_HOVER,
  GuideCardSteps,
  GuideCardTitle,
} from './EarnDesktopGuideCard';
import { EARN_GUIDE_MODAL_SIZE } from './earnGuide.utils';
import { EarnGuideArt } from './EarnGuideArt';
import { EarnGuideHeader } from './EarnGuideHeader';
import { earnGuideStore } from './earnGuideStore';

import type { IEarnGuideState, IEarnGuideStep } from './earnGuide.utils';
import type { IEarnGuideCardPlace, IEarnGuideRect } from './earnGuideStore';

// The card grows into the guide in one move with no bounce, the way a story
// card opens in the App Store, and goes back into it on the way out. The
// card itself stays in its place under the ghost, as a file stays where it
// is under its Quick Look preview. The modal and its backdrop show and hide
// at once under the ghost (the route's disableEnterExitAnimation), so the
// page has one dim the whole way: the ghost's own, until the backdrop takes
// over in the same frame
const GROW_MS = 420;
const SHRINK_MS = 380;
// The modal's content coming in under the landed ghost, and going before
// the ghost moves off on the way out
const REVEAL_MS = 180;
const COVER_MS = 120;
// In place, with no card to grow out of or go back into. The ghost and the
// page's dim run unevenly, or the page would show darker through the half
// faded ghost: on the way in the ghost leads, on the way out the dim does
const FADE_IN_MS = 200;
const FADE_OUT_MS = 200;
const FADE_LEAD = 0.7;
// The modal is pushed with a fifth of the way in to go, when the card is all
// but there (under 3 px off its place): the page's work for the push lands
// where nothing visibly moves, and the modal is up as the ghost lands
const ARRIVE_AT = 0.8;
// Past these the modal has had time to come, or to go
const READY_TIMEOUT_MS = 2000;
const LEAVE_TIMEOUT_MS = 600;
const EASE = Easing.bezierFn(0.32, 0.72, 0, 1);
// Fades: a cross-fade of the content, and the ghost in place
const EASE_FADE = Easing.bezierFn(0.4, 0, 0.2, 1);
const MODAL_RADIUS = 16;
// The title's rise from the card's padding (20) to the header's (16)
const TITLE_RISE = -4;
// The web modal's backdrop and screen, as createWebModalNavigator draws them
const BACKDROP_TEST_ID = 'app-modal-stacks-backdrop';
const SCREEN_TEST_ID = 'APP-Modal-Screen';
const BACKDROP_ALPHA = 0.5;
// The modal's ink header before the first open has measured it
export const EARN_GUIDE_HEADER_HEIGHT = 108;

/** Where the guide modal sits: the web modal's own rule, 90% of the window
 * up to its size, centred. Unrounded, as the browser lays it out (691.2 tall
 * at 38.4 in a 768 window), so the ghost lands on it to the pixel */
export function getGuideModalRect(): IEarnGuideRect {
  const vw = globalThis.innerWidth ?? 0;
  const vh = globalThis.innerHeight ?? 0;
  const width = Math.min(vw * 0.9, EARN_GUIDE_MODAL_SIZE.width);
  const height = Math.min(vh * 0.9, EARN_GUIDE_MODAL_SIZE.height);
  return { x: (vw - width) / 2, y: (vh - height) / 2, width, height };
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const between = (from: number, to: number, t: number) => from + (to - from) * t;
// 0 up to `from`, 1 from `to`, straight between
const ramp = (t: number, from: number, to: number) =>
  clamp01((t - from) / (to - from));

const parseHex = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mixHex = (from: string, to: string, t: number) => {
  const a = parseHex(from);
  const b = parseHex(to);
  return `rgb(${a.map((v, i) => Math.round(between(v, b[i], t))).join(', ')})`;
};

const findBackdrop = () =>
  globalThis.document?.querySelector<HTMLElement>(
    `[data-testid="${BACKDROP_TEST_ID}"]`,
  ) ?? undefined;

// The top one: the guide's, over any modal under it
const findScreen = () => {
  const screens = globalThis.document?.querySelectorAll<HTMLElement>(
    `[data-testid="${SCREEN_TEST_ID}"]`,
  );
  return screens?.length ? screens[screens.length - 1] : undefined;
};

function readBackdropOpacity() {
  const backdrop = findBackdrop();
  return backdrop ? Number(globalThis.getComputedStyle(backdrop).opacity) : 0;
}

// With its transition off, as the modal navigator sets it
function setOpacityAtOnce(element: HTMLElement, opacity: string) {
  const { transition } = element.style;
  element.style.transition = 'none';
  element.style.opacity = opacity;
  void element.offsetHeight;
  element.style.transition = transition;
}

// A modal let go stays out of sight whatever writes its opacity next: the
// navigator shows every modal in the stack again, inline and with its fade,
// on any change of the app's routes, and the removal waits for the ghost. A
// rule marked important wins over an inline value
const RELEASED_ATTRIBUTE = 'data-earn-guide-released';
const RELEASED_STYLE_ID = 'earn-guide-released-style';

function setReleased(element: HTMLElement, isReleased: boolean) {
  if (isReleased) {
    const doc = globalThis.document;
    if (!doc.getElementById(RELEASED_STYLE_ID)) {
      const style = doc.createElement('style');
      style.id = RELEASED_STYLE_ID;
      style.textContent = `[${RELEASED_ATTRIBUTE}] { opacity: 0 !important; transition: none !important; }`;
      doc.head.appendChild(style);
    }
    element.setAttribute(RELEASED_ATTRIBUTE, '');
    return;
  }
  // Back as it was, at once
  const { transition } = element.style;
  element.style.transition = 'none';
  element.style.opacity = '1';
  element.removeAttribute(RELEASED_ATTRIBUTE);
  void element.offsetHeight;
  element.style.transition = transition;
}

/** How strong the ghost's own dim is, for it and the backdrop together to
 * darken the page by `alpha`: one dim the whole way, whichever draws it */
function getOwnDim(alpha: number, backdropOpacity: number) {
  const backdrop = BACKDROP_ALPHA * backdropOpacity;
  return clamp01((1 - (1 - alpha) / (1 - backdrop)) / BACKDROP_ALPHA);
}

type IGhostFrame = IEarnGuideRect & {
  radius: number;
  // Off the page in flight, 0 at both ends, where it is the card or the modal
  lift: number;
  band: number;
  bandColor: string;
  // The modal header's steps and close, coming in as the card nears its size
  header: number;
  // The card's steps and action, going as it grows
  steps: number;
  // The title's rise into the header's place
  rise: number;
  // The modal's outline, drawn as the modal draws it
  ring: number;
  box: number;
  // The body under the ink: the modal's own color, over its content on
  // the way out
  cover: number;
  dim: number;
};

export type IEarnGuideGhostPlan = {
  direction: 'open' | 'close';
  /** The card's place: grown out of, or gone back into. None: in place */
  card?: IEarnGuideCardPlace;
  /** The step the modal's header shows */
  shownStep: IEarnGuideStep;
  /** Open: the ghost is about to land, and the modal can be pushed. It
   * stays out of sight under the ghost until the ghost has landed */
  onArriving?: () => void;
  /** Close: the ghost covers the modal, which can go */
  onCovered?: () => void;
  /** Close: the modal is removed under the covering ghost, which moves off
   * once it has gone, for a leave that changes what the ghost uncovers (the
   * hero once the guide ends, the positions page). Otherwise the modal goes
   * from under the ghost at once and is removed after the ghost is back,
   * so the removal's page work can't stall the ghost as it moves */
  holdsForLeave?: boolean;
};

type IPhase =
  | 'grow'
  | 'fadeIn'
  | 'wait'
  | 'reveal'
  | 'cover'
  | 'leave'
  | 'shrink'
  | 'fadeOut';

const styleOf = (ref: { current: unknown }) =>
  (ref.current as HTMLElement | null)?.style;

function EarnGuideGhostView({
  direction,
  card,
  shownStep,
  state,
  headerHeight,
  onArriving,
  onCovered,
  holdsForLeave,
  onDone,
}: IEarnGuideGhostPlan & {
  state: IEarnGuideState;
  headerHeight: number;
  onDone: () => void;
}) {
  const theme = useTheme();
  const modal = useRef(getGuideModalRect()).current;
  const dimRef = useRef<unknown>(null);
  const ringRef = useRef<unknown>(null);
  const boxRef = useRef<unknown>(null);
  const coverRef = useRef<unknown>(null);
  const bandRef = useRef<unknown>(null);
  const headerRef = useRef<unknown>(null);
  const titleRef = useRef<unknown>(null);
  const stepsRef = useRef<unknown>(null);
  const artRef = useRef<unknown>(null);

  // One loop draws every layer from the same frame, written straight to the
  // page
  useEffect(() => {
    const setDim = (opacity: number) => {
      const dim = styleOf(dimRef);
      const value = `${opacity}`;
      // Unchanged, no write: the observer below sees every style write
      if (dim && dim.opacity !== value) {
        dim.opacity = value;
      }
    };
    const draw = (frame: IGhostFrame) => {
      const box = styleOf(boxRef);
      const ring = styleOf(ringRef);
      if (!box || !ring) {
        return;
      }
      box.left = `${frame.x}px`;
      box.top = `${frame.y}px`;
      box.width = `${frame.width}px`;
      box.height = `${frame.height}px`;
      box.borderRadius = `${frame.radius}px`;
      box.opacity = `${frame.box}`;
      box.boxShadow =
        frame.lift > 0
          ? `0 ${12 * frame.lift}px ${40 * frame.lift}px rgba(0, 0, 0, ${0.2 * frame.lift})`
          : 'none';
      ring.left = `${frame.x - 1}px`;
      ring.top = `${frame.y - 1}px`;
      ring.width = `${frame.width + 2}px`;
      ring.height = `${frame.height + 2}px`;
      ring.borderRadius = `${frame.radius + 1}px`;
      ring.opacity = `${frame.ring}`;
      Object.assign(styleOf(bandRef) ?? {}, {
        height: `${frame.band}px`,
        backgroundColor: frame.bandColor,
      });
      Object.assign(styleOf(coverRef) ?? {}, { opacity: `${frame.cover}` });
      Object.assign(styleOf(headerRef) ?? {}, { opacity: `${frame.header}` });
      Object.assign(styleOf(stepsRef) ?? {}, { opacity: `${frame.steps}` });
      Object.assign(styleOf(artRef) ?? {}, { opacity: `${frame.steps}` });
      Object.assign(styleOf(titleRef) ?? {}, {
        transform: `translateY(${frame.rise}px)`,
      });
      setDim(frame.dim);
    };

    const atModal = {
      ...modal,
      radius: MODAL_RADIUS,
      lift: 0,
      band: headerHeight,
      bandColor: EARN_GUIDE_INK,
      header: 1,
      steps: 0,
      rise: TITLE_RISE,
      ring: 1,
    };
    // The card's ink as the pointer leaves it, lit when over it
    const cardColor = card?.isHovered ? EARN_GUIDE_INK_HOVER : EARN_GUIDE_INK;
    // 0 is the card, 1 the modal. The ghost stays all ink through the
    // first of the move, a card growing, and the modal's body opens under
    // the ink as it nears its place and the page has dimmed; a white body
    // early on would read as a hole in a light page
    const moved = (p: number) => {
      if (!card) {
        return atModal;
      }
      const height = between(card.height, modal.height, p);
      return {
        x: between(card.x, modal.x, p),
        y: between(card.y, modal.y, p),
        width: between(card.width, modal.width, p),
        height,
        radius: between(EARN_GUIDE_CARD_RADIUS, MODAL_RADIUS, p),
        lift: Math.round(Math.sin(Math.PI * p) * 1000) / 1000,
        band: between(height, headerHeight, ramp(p, 0.25, 0.85)),
        bandColor: mixHex(cardColor, EARN_GUIDE_INK, ramp(p, 0, 0.4)),
        header: ramp(p, 0.55, 1),
        steps: 1 - ramp(p, 0, 0.3),
        rise: between(0, TITLE_RISE, p),
        ring: ramp(p, 0.5, 1),
      };
    };

    let phase: IPhase;
    if (direction === 'open') {
      phase = card ? 'grow' : 'fadeIn';
    } else {
      phase = 'cover';
    }
    let phaseStart = performance.now();
    let frameId = 0;
    let isDone = false;
    let isPushed = false;
    // The modal kept out of sight under the ghost: up before the ghost has
    // landed, or going from under it on the way out
    let hiddenScreen: HTMLElement | undefined;
    let releasedScreen: HTMLElement | undefined;
    let releasedBackdrop: HTMLElement | undefined;
    let isReleased = false;
    // By its opacity, as the navigator shows and hides it (its content can
    // stay visible in a hidden visibility)
    const hideScreen = () => {
      const screen = findScreen();
      if (screen && screen.style.opacity !== '0') {
        setOpacityAtOnce(screen, '0');
        hiddenScreen = screen;
      }
    };
    const showScreen = () => {
      if (hiddenScreen) {
        setOpacityAtOnce(hiddenScreen, '1');
        hiddenScreen = undefined;
      }
    };
    // The way out: the modal and its backdrop go from under the covering
    // ghost in this frame, the ghost's own dim taking over
    const releaseModal = () => {
      isReleased = true;
      releasedScreen = findScreen();
      releasedBackdrop = findBackdrop();
      [releasedScreen, releasedBackdrop].forEach(
        (element) => element && setReleased(element, true),
      );
      setDim(1);
    };
    // A modal out of sight shows again as it was: at once when the ghost
    // goes before letting it go, or if a removal asked for never came
    const restoreModal = (after = 0) => {
      const screen = hiddenScreen;
      const letGoScreen = releasedScreen;
      const backdrop = releasedBackdrop;
      hiddenScreen = undefined;
      releasedScreen = undefined;
      releasedBackdrop = undefined;
      const restore = () => {
        if (screen?.isConnected) {
          setOpacityAtOnce(screen, '1');
        }
        if (letGoScreen?.isConnected) {
          setReleased(letGoScreen, false);
          if (backdrop?.isConnected) {
            setReleased(backdrop, false);
          }
        } else {
          // Removed: a backdrop that stays (a modal under the guide's) goes
          // back to the navigator's own value
          backdrop?.removeAttribute(RELEASED_ATTRIBUTE);
        }
      };
      if (after) {
        setTimeout(restore, after);
      } else {
        restore();
      }
    };
    // A push or a removal can render the modal (or take it away) at once,
    // inside the call: it is made at the top of the next frame, and what it
    // shows is read below, before that frame paints
    let pending: (() => void) | undefined;
    // The dim changes hands with the backdrop in the task that shows or
    // hides it, before any paint: a frame can paint before the loop's next
    // turn while the page is busy rendering the modal, and would show the
    // two dims at once, or none
    const observer =
      typeof MutationObserver === 'undefined'
        ? undefined
        : new MutationObserver(() => {
            if ((phase === 'grow' || phase === 'fadeIn') && isPushed) {
              // Up before the ghost has landed: out of sight under it until
              // then, the backdrop taking the dim over now
              hideScreen();
              setDim(getOwnDim(BACKDROP_ALPHA, readBackdropOpacity()));
            } else if (phase === 'wait' || phase === 'leave') {
              setDim(getOwnDim(BACKDROP_ALPHA, readBackdropOpacity()));
            }
          });
    observer?.observe(globalThis.document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style'],
    });
    const enter = (next: IPhase, now: number, then?: () => void) => {
      phase = next;
      phaseStart = now;
      if (then) {
        pending = then;
      }
    };
    const pushNear = (t: number, duration: number) => {
      if (!isPushed && t >= duration * ARRIVE_AT) {
        isPushed = true;
        pending = onArriving;
      }
    };

    const tick = (frameTime: number) => {
      if (pending) {
        const run = pending;
        pending = undefined;
        run();
      }
      // The call may have taken a while: the time is read after it
      const now = Math.max(frameTime, performance.now());
      const t = Math.max(0, now - phaseStart);
      const backdrop = readBackdropOpacity();
      // The dim at full, the ghost's share of it beside the backdrop's
      const fullDim = getOwnDim(BACKDROP_ALPHA, backdrop);
      switch (phase) {
        case 'grow': {
          const p = EASE(clamp01(t / GROW_MS));
          draw({
            ...moved(p),
            box: 1,
            cover: 1,
            dim: getOwnDim(BACKDROP_ALPHA * p, backdrop),
          });
          pushNear(t, GROW_MS);
          if (t >= GROW_MS) {
            enter('wait', now);
          }
          break;
        }
        case 'fadeIn': {
          const shown = EASE_FADE(clamp01(t / (FADE_IN_MS * FADE_LEAD)));
          const dimmed = EASE_FADE(clamp01(t / FADE_IN_MS));
          draw({
            ...atModal,
            ring: shown,
            box: shown,
            cover: 1,
            dim: getOwnDim(BACKDROP_ALPHA * dimmed, backdrop),
          });
          pushNear(t, FADE_IN_MS);
          if (t >= FADE_IN_MS) {
            enter('wait', now);
          }
          break;
        }
        // Landed: the modal, up already or still coming, shows under the
        // ghost, its backdrop holding the dim, then its content comes in
        case 'wait': {
          showScreen();
          draw({ ...atModal, box: 1, cover: 1, dim: fullDim });
          // Its screen in the page is enough: the page marks itself open a
          // frame or more later
          if (
            backdrop > 0.99 &&
            (findScreen() || earnGuideStore.getSnapshot().isModalOpen)
          ) {
            enter('reveal', now);
          } else if (t > READY_TIMEOUT_MS) {
            // The modal never came: the page back as it was
            enter('fadeOut', now);
          }
          break;
        }
        case 'reveal': {
          const e = EASE_FADE(clamp01(t / REVEAL_MS));
          draw({
            ...atModal,
            ring: 1 - e,
            box: 1 - e,
            cover: 1,
            dim: fullDim,
          });
          if (t >= REVEAL_MS) {
            isDone = true;
          }
          break;
        }
        // On the way out the content goes under the ghost's body first, the
        // header staying as it is, before the modal is let go
        case 'cover': {
          const e = EASE_FADE(clamp01(t / COVER_MS));
          draw({ ...atModal, box: 1, cover: e, dim: fullDim });
          if (t >= COVER_MS) {
            if (holdsForLeave) {
              enter('leave', now, onCovered);
            } else {
              // Out from under the ghost now, removed once it is back
              releaseModal();
              enter(card ? 'shrink' : 'fadeOut', now);
            }
          }
          break;
        }
        case 'leave': {
          draw({ ...atModal, box: 1, cover: 1, dim: fullDim });
          if (backdrop < 0.01) {
            enter(card ? 'shrink' : 'fadeOut', now);
          } else if (t > LEAVE_TIMEOUT_MS) {
            // The modal stayed: its content back
            enter('reveal', now);
          }
          break;
        }
        case 'shrink': {
          const p = 1 - EASE(clamp01(t / SHRINK_MS));
          draw({
            ...moved(p),
            box: 1,
            cover: 1,
            dim: getOwnDim(BACKDROP_ALPHA * p, backdrop),
          });
          // Back on the card, which is the same to the pixel: gone at once
          if (t >= SHRINK_MS) {
            isDone = true;
          }
          break;
        }
        case 'fadeOut': {
          const gone = EASE_FADE(clamp01(t / FADE_OUT_MS));
          const undimmed = EASE_FADE(clamp01(t / (FADE_OUT_MS * FADE_LEAD)));
          draw({
            ...atModal,
            ring: 1 - gone,
            box: 1 - gone,
            cover: 1,
            dim: getOwnDim(BACKDROP_ALPHA * (1 - undimmed), backdrop),
          });
          if (t >= FADE_OUT_MS) {
            isDone = true;
          }
          break;
        }
        default:
          break;
      }
      if (isDone) {
        observer?.disconnect();
        if (isReleased) {
          // Back: the modal let go is removed now
          onCovered?.();
          restoreModal(LEAVE_TIMEOUT_MS);
        } else {
          restoreModal();
        }
        onDone();
        return;
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frameId);
      observer?.disconnect();
      // Never a modal left out of sight
      restoreModal();
    };
    // One run per ghost
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drawn by the loop from its first frame on, before any paint
  return (
    <>
      <YStack
        ref={dimRef as never}
        pointerEvents="none"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: `rgba(0, 0, 0, ${BACKDROP_ALPHA})`,
          opacity: 0,
        }}
      />
      <YStack
        ref={ringRef as never}
        pointerEvents="none"
        style={{
          position: 'fixed',
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: theme.borderSubdued.val,
          opacity: 0,
        }}
      />
      <YStack
        ref={boxRef as never}
        testID="earn-guide-ghost"
        pointerEvents="none"
        style={{ position: 'fixed', overflow: 'hidden', opacity: 0 }}
      >
        <YStack
          ref={coverRef as never}
          position="absolute"
          top={0}
          left={0}
          right={0}
          bottom={0}
          bg="$bgApp"
        />
        <YStack
          ref={bandRef as never}
          position="absolute"
          top={0}
          left={0}
          right={0}
          overflow="hidden"
        >
          {/* The card's picture, at the card's size: it goes with the
              card's steps as the ink becomes the modal's header */}
          <YStack
            ref={artRef as never}
            position="absolute"
            top={0}
            left={0}
            width={card?.width ?? modal.width}
            height={card?.height ?? headerHeight}
          >
            <EarnGuideArt radius={EARN_GUIDE_CARD_RADIUS} />
          </YStack>
        </YStack>
        <YStack
          ref={headerRef as never}
          position="absolute"
          top={0}
          left={0}
          width={modal.width}
        >
          <EarnGuideHeader shownStep={shownStep} isCopy />
        </YStack>
        {/* The card's own layout at the card's size, pinned to the corner
            the title shares with the modal's header; in place, the header's
            title alone */}
        <Theme name="dark">
          <YStack
            position="absolute"
            top={0}
            left={0}
            width={card?.width ?? modal.width}
            height={card?.height ?? headerHeight}
            p="$5"
            pb={EARN_GUIDE_CARD_PB}
            gap="$4"
            jc="space-between"
          >
            <YStack ref={titleRef as never}>
              <GuideCardTitle />
            </YStack>
            <YStack ref={stepsRef as never}>
              <GuideCardSteps state={state} />
            </YStack>
          </YStack>
        </Theme>
      </YStack>
    </>
  );
}

export const EarnGuideGhost = memo(EarnGuideGhostView);
