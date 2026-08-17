import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';

import { BottomSheet as ExpoBottomSheet, RNHostView } from '@expo/ui';
import {
  createModifier,
  frame,
  interactiveDismissDisabled,
  presentationBackground,
  presentationBackgroundInteraction,
  presentationDetents,
} from '@expo/ui/swift-ui/modifiers';
import { useWindowDimensions } from 'react-native';

import { useThemeName } from '@onekeyhq/components/src/hooks/useStyle';

import { Stack } from '../../primitives';

import type { LayoutChangeEvent } from 'react-native';

/**
 * The system bottom sheet. By default it is content-sized: whatever the
 * children measure is the height the sheet stands at, and later growth or
 * shrinkage rides the system's own detent animation. That is a default,
 * not a law — explicit `snapPoints` take the height over, and the sheet
 * then rests at the given stops with the person dragging between them.
 * Native-only — nothing on the web maps to a system sheet, so there is no
 * web counterpart file; a cross-platform consumer does its own platform
 * split at its own level (DialogV2 presents a Base UI popup on web and
 * this sheet on iOS).
 *
 * The sheet itself is the system presentation — corner radius, backdrop, drag
 * physics and the iPad form-sheet variant all come from UIKit, so nothing here
 * styles them. Only the content inside is ours, and it comes with the shell's
 * inset contract: 24pt from the side edges, a 16pt gap under the last element
 * with the system's own safe area beneath — consumers pad neither.
 *
 * Height, in the content-sized default: the first frame presents through
 * the wrapper's fitToContents, then a JS measurement of the content takes
 * over as explicit height detents with a selection. fitToContents alone
 * only gets the presentation-time height right — it feeds SwiftUI through
 * a KVO on the RN root view's bounds, which UIKit does not reliably fire
 * on later re-layouts, so a sheet whose content grows or shrinks never
 * moves. The JS measurement drives detents through props, which always
 * update; and the height change rides a detent-selection change, the one
 * path the system animates. With explicit snapPoints the whole mechanism
 * stands down: the caller owns the height, upstream behavior applies.
 *
 * One exception to "the system styles the chrome": the system draws it against
 * its own appearance, blind to the Tamagui context, so a subtree pinned with
 * <Theme name="dark"> would get dark content on a light sheet. Mirroring the
 * ambient scheme into the presentation is the native counterpart of the
 * data-theme stamp on the web portal — and it must go through SwiftUI's
 * preferredColorScheme, which flows up to the enclosing presentation and
 * restyles the sheet chrome in place, material intact. The two in-package
 * levers both fall short: environment(colorScheme) stops at the content
 * subtree, and a presentationBackground fill replaces the glass material
 * with flat paint. The registry entry ships in our @expo/ui patch; upstream
 * has no TS helper for it, so the config is built directly.
 */

const preferredColorScheme = (value: 'light' | 'dark') =>
  createModifier('preferredColorScheme', { colorScheme: value });

// Side padding the universal BottomSheet wrapper puts around its content.
const SHEET_SIDE_PADDING = 16;
// Top padding from the same wrapper: part of the sheet's visible height.
const SHEET_TOP_PADDING = 16;
// The sheet's content contract: children sit this far from the sheet's
// side edges. The wrapper's fixed padding is topped up to it here, so
// consumers write no side padding of their own.
const CONTENT_SIDE_INSET = 24;
const CONTENT_SIDE_TOP_UP = CONTENT_SIDE_INSET - SHEET_SIDE_PADDING;
// Breathing room under the content. The system keeps the whole content
// box above the home-indicator safe area on its own; this is only the
// visual gap between the last element and that zone.
const CONTENT_BOTTOM_PADDING = 16;
// How long the outgoing height detent outlives a change: past the system's
// detent spring, short enough that a drag can rarely catch it.
const DETENT_SETTLE_MS = 800;

export interface IBottomSheetProps {
  /** Controlled visibility. There is no uncontrolled mode on purpose. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Measured content; the sheet stands at whatever height it takes. */
  children?: ReactNode;
  /**
   * Explicit rest heights — the type is the upstream prop's own, taken
   * verbatim ('half' | 'full' | fraction-of-screen | fixed height), so
   * this stays whatever expo says it is. Omitted — the default — the
   * sheet sizes itself to its content and follows it as it changes;
   * given, the caller takes the height over: the sheet rests at these
   * stops, draggable between them, and the content measurement stands
   * down.
   */
  snapPoints?: ComponentProps<typeof ExpoBottomSheet>['snapPoints'];
  /**
   * When false, the drag indicator hides and interactive dismissal is
   * disabled — closing becomes the content's job.
   */
  dismissible?: boolean;
  /**
   * Opaque paint over the whole sheet face (presentationBackground),
   * replacing the platform material. For stage-like surfaces that must not
   * sample what is behind them.
   */
  background?: string;
  /**
   * Keeps the app behind the sheet interactive instead of dimmed-and-inert
   * (iOS presentationBackgroundInteraction, 16.4+).
   */
  backgroundInteractive?: boolean;
}

export function BottomSheet({
  open,
  onOpenChange,
  children,
  snapPoints,
  dismissible = true,
  background,
  backgroundInteractive,
}: IBottomSheetProps) {
  const themeName = useThemeName();
  const scheme = themeName.includes('dark') ? 'dark' : 'light';
  const contentSized = !snapPoints?.length;

  // Sheet heights as detents: the current one plus, transiently, the one
  // before it. Keeping the old height alive through the transition lets
  // the system animate the selection change between them — a plain
  // detent-set replacement snaps with no animation. But it is an
  // animation anchor, not a rest stop, so it retires below once the
  // spring has settled: the sheet then has exactly one detent — the
  // content's height — and the drag handle cannot park it at a stale
  // size.
  const [sheetHeights, setSheetHeights] = useState<{
    prev?: number;
    current: number;
  } | null>(null);
  const handleContentLayout = useCallback(
    (event: LayoutChangeEvent) => {
      // Explicit snap points own the height; measuring stands down.
      if (!contentSized) return;
      const next =
        Math.ceil(event.nativeEvent.layout.height) + SHEET_TOP_PADDING;
      setSheetHeights((state) => {
        if (!state) return { current: next };
        if (state.current === next) return state;
        return { prev: state.current, current: next };
      });
    },
    [contentSized],
  );
  useEffect(() => {
    if (sheetHeights?.prev === undefined) return undefined;
    const id = setTimeout(() => {
      setSheetHeights((state) =>
        state?.prev === undefined ? state : { current: state.current },
      );
    }, DETENT_SETTLE_MS);
    return () => clearTimeout(id);
  }, [sheetHeights]);

  // `prev` is only ever set to a height that differs from `current` (the
  // layout handler drops no-op measurements), so its presence is the whole
  // test. The same list feeds two places: as snapPoints it turns the
  // wrapper's broken fitToContents measuring off while keeping the
  // wrapper's own detent list identical to ours — no foreign stop (the old
  // 'half' placeholder read as a hard 50% height) exists to win, whichever
  // copy the system honours; and in `modifiers` it carries the selection,
  // the one path the system animates.
  const detents = useMemo(() => {
    if (!contentSized || !sheetHeights) return null;
    return sheetHeights.prev !== undefined
      ? [{ height: sheetHeights.prev }, { height: sheetHeights.current }]
      : [{ height: sheetHeights.current }];
  }, [contentSized, sheetHeights]);

  const modifiers = useMemo(() => {
    const list = [preferredColorScheme(scheme)];
    if (detents && sheetHeights) {
      list.push(
        presentationDetents(detents, {
          selection: { height: sheetHeights.current },
        }),
      );
    }
    if (background) {
      // Deliberately trades the glass material for opaque paint — the caller
      // asked for a face that does not sample what is behind it.
      list.push(presentationBackground(background));
    }
    if (backgroundInteractive) {
      // Touches pass to the presenting view while the sheet is up (iOS 16.4+).
      list.push(presentationBackgroundInteraction('enabled'));
    }
    if (!dismissible) {
      list.push(interactiveDismissDisabled(true));
    }
    // Outermost on purpose: make the content box exactly the height the
    // sheet offers, and pin the content to its top. The box is otherwise
    // sized by the RN content, so while the sheet animates to a taller
    // detent the box is the bigger of the two and the sheet centres it —
    // the whole stage jumps up and clips for those frames. Pinned, it
    // holds still and the growth simply hangs past the bottom edge until
    // the sheet arrives to reveal it.
    //
    // Both bounds, not just a maximum: a flexible frame given only a
    // maximum never reports smaller than its child, so it inflates and
    // the alignment has nothing left to align. The minimum is what makes
    // it clamp to the offered height instead.
    list.push(frame({ minHeight: 0, maxHeight: Infinity, alignment: 'top' }));
    return list;
  }, [
    background,
    backgroundInteractive,
    detents,
    dismissible,
    scheme,
    sheetHeights,
  ]);

  // The host frame spans the sheet but aligns its content topLeading with
  // 16pt side padding (the universal BottomSheet wrapper), and the RN content
  // is measured intrinsically — without an explicit width the column collapses
  // to its widest child and everything hangs left, jumping as titles change.
  // Fill the padded frame instead; on iPhone the sheet spans the window. iPad
  // form sheets are narrower and will need the real container width if the
  // exploration ever goes there.
  const { width: windowWidth } = useWindowDimensions();
  const contentWidth = windowWidth - 2 * SHEET_SIDE_PADDING;

  const handleDismiss = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <ExpoBottomSheet
      isPresented={open}
      onDismiss={handleDismiss}
      showDragIndicator={dismissible}
      snapPoints={contentSized ? (detents ?? undefined) : snapPoints}
      modifiers={modifiers}
    >
      <RNHostView matchContents>
        <Stack
          width={contentWidth}
          px={CONTENT_SIDE_TOP_UP}
          pb={CONTENT_BOTTOM_PADDING}
          onLayout={handleContentLayout}
        >
          {children}
        </Stack>
      </RNHostView>
    </ExpoBottomSheet>
  );
}
