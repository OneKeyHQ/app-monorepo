import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import type { ReactNode, SyntheticEvent } from 'react';

import { createPortal } from 'react-dom';
import { StyleSheet, View } from 'react-native';

import { OVERLAY_LEVEL_ORDER, isBlockingLevel } from './OverlayLevels';
import { OVERLAY_OWNER_ATTRIBUTE } from './OverlayPageHost.web';
import { useOverlayController } from './useOverlayController';
import { animateBackdrop, animateTransition } from './web/animateTransition';
import {
  ENTRY_ATTRIBUTE,
  getOverlayLayerRoot,
  getOverlayPageHost,
  registerOverlayDismissRequester,
  scheduleOverlayInertSync,
} from './web/overlayLayers';
import { useKeyboardShift } from './web/useKeyboardShift';
import { useSheetDrag } from './web/useSheetDrag';

import type { IResolvedOverlayAnimation } from './animation/resolveAnimation';
import type {
  IOverlayRequestDismissReason,
  IOverlaySheetOptions,
  IOverlayViewProps,
} from './OverlayViewTypes';

const DEFAULT_BACKDROP_COLOR = 'rgba(0, 0, 0, 0.4)';
const DEFAULT_SHEET_MAX_HEIGHT = '92vh';
const DEFAULT_SHEET_CORNER_RADIUS = 24;

// Portaled content still bubbles React events to the caller's ancestors;
// stop them at the entry so presses cannot reach the page underneath.
// Mouse and touch events must keep bubbling natively: react-native-web's
// responder system (PanResponder, gesture responders) listens for them on
// `document`, and a React stopPropagation also stops the native event.
const stopPropagation = (event: SyntheticEvent) => event.stopPropagation();
const ISOLATED_EVENT_HANDLERS = {
  onClick: stopPropagation,
  onPointerDown: stopPropagation,
  onPointerUp: stopPropagation,
  onKeyDown: stopPropagation,
};

interface IWebOverlayEntryProps {
  entryId: string;
  /** Closed but kept mounted: hidden and inert. */
  parked?: boolean;
  stackOrder: number;
  presented: boolean;
  animation: IResolvedOverlayAnimation;
  blocking: boolean;
  backdropColor: string | undefined;
  dismissOnBackdropPress: boolean;
  onPresented: () => void;
  onDismissed: () => void;
  onRequestDismiss: (reason: IOverlayRequestDismissReason) => void;
  /** Set for `presentation="sheet"`. */
  sheet: IOverlaySheetOptions | undefined;
  /** Page scope: stacking inside the page host and the owning page. */
  zIndex: number;
  ownerKey: string | undefined;
  testID?: string;
  children?: ReactNode;
}

function WebOverlayEntry({
  entryId,
  parked = false,
  stackOrder,
  presented,
  animation,
  blocking,
  backdropColor,
  dismissOnBackdropPress,
  onPresented,
  onDismissed,
  onRequestDismiss,
  sheet,
  zIndex,
  ownerKey,
  testID,
  children,
}: IWebOverlayEntryProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  // A pan dismissal already moved the sheet off screen; skip the exit run.
  const pannedAwayRef = useRef(false);
  const isSheet = !!sheet;
  const entryRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const keyboardLayerRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const directionRef = useRef<'in' | 'out' | undefined>(undefined);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const callbacksRef = useRef({ onPresented, onDismissed });
  callbacksRef.current = { onPresented, onDismissed };

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) {
      return;
    }
    const direction = presented ? 'in' : 'out';
    if (directionRef.current === direction) {
      return;
    }
    const neverEntered = directionRef.current === undefined;
    directionRef.current = direction;
    scheduleOverlayInertSync();
    if (direction === 'out' && (neverEntered || pannedAwayRef.current)) {
      callbacksRef.current.onDismissed();
      return;
    }
    if (direction === 'in' && blocking) {
      restoreFocusRef.current = document.activeElement as HTMLElement | null;
      entryRef.current?.focus({ preventScroll: true });
    }
    content.getAnimations().forEach((running) => running.cancel());
    backdropRef.current?.getAnimations().forEach((running) => running.cancel());
    // A sheet is measured as a whole; other presentations by the children
    // of the full-window React root.
    const contentRoot = isSheet
      ? content
      : ((content.firstElementChild as HTMLElement | null) ?? content);
    const transition = direction === 'in' ? animation.enter : animation.exit;
    const running = [
      animateTransition(content, contentRoot, transition, direction),
      backdropRef.current
        ? animateBackdrop(
            backdropRef.current,
            animation.backdrop.motion,
            direction,
          )
        : undefined,
    ].filter((item): item is Animation => !!item);
    void Promise.all(running.map((item) => item.finished))
      .then(() => {
        if (directionRef.current !== direction) {
          return;
        }
        if (direction === 'in') {
          callbacksRef.current.onPresented();
        } else {
          restoreFocusRef.current?.focus?.({ preventScroll: true });
          restoreFocusRef.current = null;
          callbacksRef.current.onDismissed();
        }
      })
      .catch(() => {
        // Cancelled by a newer transition; that run reports instead.
      });
  }, [presented, animation, blocking, isSheet]);

  useEffect(
    () => registerOverlayDismissRequester(entryId, onRequestDismiss),
    [entryId, onRequestDismiss],
  );

  // A plain DOM listener: the backdrop is a pointer target only; keyboard
  // users dismiss with Escape through the layer manager.
  useEffect(() => {
    const backdropNode = backdropRef.current;
    if (!backdropNode || !dismissOnBackdropPress) {
      return;
    }
    const onBackdropClick = () => onRequestDismiss('backdrop');
    backdropNode.addEventListener('click', onBackdropClick);
    return () => backdropNode.removeEventListener('click', onBackdropClick);
  }, [dismissOnBackdropPress, onRequestDismiss]);

  useKeyboardShift({
    layerRef: keyboardLayerRef,
    sheetRef,
    contentRef,
    isSheet,
    enabled: presented,
  });

  useSheetDrag({
    sheetRef,
    backdropRef,
    enabled: !!sheet && (sheet.dismissOnPanDown ?? true) && presented,
    onDismissByPan: () => {
      pannedAwayRef.current = true;
      onRequestDismiss('pan');
    },
  });

  const showBackdrop = !!backdropColor || blocking;
  const cornerRadius = sheet?.cornerRadius ?? DEFAULT_SHEET_CORNER_RADIUS;

  return (
    <div
      ref={entryRef}
      {...{ [ENTRY_ATTRIBUTE]: '' }}
      {...(ownerKey ? { [OVERLAY_OWNER_ATTRIBUTE]: ownerKey } : {})}
      data-stack-order={stackOrder}
      data-testid={testID}
      role={blocking ? 'dialog' : undefined}
      aria-modal={blocking || undefined}
      tabIndex={-1}
      inert={parked || undefined}
      aria-hidden={parked || undefined}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex,
        pointerEvents: 'none',
        outline: 'none',
        visibility: parked ? 'hidden' : undefined,
      }}
      {...ISOLATED_EVENT_HANDLERS}
    >
      {showBackdrop ? (
        <div
          ref={backdropRef}
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            opacity: 0,
            background: backdropColor ?? 'transparent',
            pointerEvents: blocking ? 'auto' : 'none',
          }}
        />
      ) : null}
      {/* The keyboard lift lives on its own layer so it composes with the
          enter / exit animation on the content below. It only carries a
          transform while lifted: a transform would re-anchor fixed children. */}
      <div
        ref={keyboardLayerRef}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          transition: 'transform 250ms ease-out',
        }}
      >
        <div
          ref={contentRef}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          {sheet ? (
            <div
              ref={sheetRef}
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: sheet.height,
                maxHeight: sheet.maxHeight ?? DEFAULT_SHEET_MAX_HEIGHT,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                pointerEvents: 'auto',
                touchAction: 'pan-y',
                background: sheet.backgroundColor
                  ? String(sheet.backgroundColor)
                  : undefined,
                borderTopLeftRadius: cornerRadius,
                borderTopRightRadius: cornerRadius,
              }}
            >
              {sheet.showHandle ? (
                <div
                  style={{
                    alignSelf: 'center',
                    width: 36,
                    height: 5,
                    marginTop: 8,
                    borderRadius: 2.5,
                    background: 'rgba(0, 0, 0, 0.2)',
                    flexShrink: 0,
                  }}
                />
              ) : null}
              <View style={{ flexShrink: 1 }}>{children}</View>
            </div>
          ) : (
            <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
              {children}
            </View>
          )}
        </div>
      </div>
    </div>
  );
}

export function OverlayView(props: IOverlayViewProps) {
  const {
    level = 'modal',
    presentation = 'center',
    backdrop,
    blocking,
    sheet,
    keepContentMounted = false,
    children,
    testID,
  } = props;
  const parkedId = useId();
  const {
    entry,
    mounted,
    presented,
    animation,
    onHostPresented,
    onHostDismissed,
    onHostRequestDismiss,
    scope,
    hostKey,
    ownerKey,
  } = useOverlayController(props);

  // Closed with `keepContentMounted`: the same entry stays in the layer,
  // hidden and inert, so the content keeps its state and can be measured.
  const parked = !mounted || !entry;
  if (parked && !keepContentMounted) {
    return null;
  }

  const pageHost =
    !parked && scope === 'page' ? getOverlayPageHost(hostKey) : undefined;
  return createPortal(
    <WebOverlayEntry
      key="entry"
      parked={parked}
      entryId={entry?.id ?? parkedId}
      stackOrder={entry?.seq ?? 0}
      presented={!parked && presented}
      animation={animation}
      blocking={blocking ?? isBlockingLevel(level)}
      backdropColor={
        backdrop ? String(backdrop.color ?? DEFAULT_BACKDROP_COLOR) : undefined
      }
      dismissOnBackdropPress={backdrop ? !!backdrop.dismissOnPress : false}
      onPresented={onHostPresented}
      onDismissed={onHostDismissed}
      onRequestDismiss={onHostRequestDismiss}
      sheet={presentation === 'sheet' ? (sheet ?? {}) : undefined}
      // Inside a page host all levels share one stacking context.
      zIndex={
        pageHost
          ? OVERLAY_LEVEL_ORDER[level] * 1000 + (entry?.seq ?? 0)
          : (entry?.seq ?? 0)
      }
      ownerKey={pageHost ? ownerKey : undefined}
      testID={testID}
    >
      {children}
    </WebOverlayEntry>,
    pageHost ?? getOverlayLayerRoot(level),
  );
}
