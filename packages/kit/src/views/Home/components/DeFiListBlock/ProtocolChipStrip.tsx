import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { StyleSheet } from 'react-native';
import Animated, {
  type SharedValue,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
} from 'react-native-reanimated';

import {
  IconButton,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IScrollViewRef } from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY } from '@onekeyhq/components/src/utils/animationConstants';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { buildProtocolDisplayInfo } from '@onekeyhq/kit/src/utils/defiPositionUtils';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import type {
  IDeFiProtocol,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';

import { isChipFullyVisible } from '../../pages/defiDesktopStickyDom';

const CHIP_PADDING_Y = '$1' as const;
const CHIP_PADDING_LEFT = '$1.5' as const;
const CHIP_PADDING_RIGHT = '$3' as const;
const CHIP_GAP = '$1.5' as const;
const STRIP_PADDING_Y = '$2' as const;

const FADE_LEFT = 'linear-gradient(90deg, var(--bgApp) 40%, transparent 100%)';
const FADE_RIGHT =
  'linear-gradient(270deg, var(--bgApp) 40%, transparent 100%)';

const LOGO_HALO_PAD = '$0.5' as const;
const REVEAL_TRANSLATE_PX = 6;
const VISIBILITY_TOLERANCE_PX = 1;
// 70% of viewport so the rightmost chip from the previous "page" stays
// visible as the user paginates with the arrow buttons.
const ARROW_PAGE_FRACTION = 0.7;
// Grace window after the last horizontal scroll of the strip itself.
// Inside this window the snap-back recenter is held off so the user has
// time to aim and click on a chip they just scrolled into view, then
// runs once when the window closes. The browser's smooth-scroll on long
// jumps is ~500ms; 1500ms covers a comfortable scroll-then-aim-then-click
// sequence with margin.
const STRIP_SCROLL_GRACE_MS = 1500;

// Distinguishes "the strip's active chip changed because the page scrolled"
// (must always recenter, even mid-grace) from automatic catch-ups
// (debounced snap-back after the user scrolled the strip themselves,
// ResizeObserver after a layout shift, gate-release catch-ups). Encoded
// as a reason string at call sites so the intent is readable there.
type IRecenterReason = 'activeKey' | 'auto';

type IProtocolChipProps = {
  chipKey: string;
  protocol: IDeFiProtocol;
  name: string;
  logo?: string;
  isActive: boolean;
  reducedMotion: boolean;
  onPress: (protocol: IDeFiProtocol) => void;
  // DOM node, not RN onLayout coordinates. See chipNodesRef in
  // ProtocolChipStripBase for the reasoning.
  onNodeRef: (key: string, node: HTMLElement | null) => void;
};

function ProtocolChipBase({
  chipKey,
  protocol,
  name,
  logo,
  isActive,
  reducedMotion,
  onPress,
  onNodeRef,
}: IProtocolChipProps) {
  const handlePress = useCallback(() => onPress(protocol), [onPress, protocol]);
  const handleNodeRef = useCallback(
    (node: unknown) => {
      onNodeRef(chipKey, (node as HTMLElement | null) ?? null);
    },
    [chipKey, onNodeRef],
  );

  return (
    <XStack
      ref={handleNodeRef}
      onPress={handlePress}
      role="button"
      // 'location' (vs 'true') tells screen readers the chip is a nav
      // target inside a scroll-spy strip, not a generic toggle.
      aria-current={isActive ? 'location' : undefined}
      cursor="pointer"
      // Keyboard reach + focus ring. `outline` follows `border-radius`
      // in modern browsers, so the ring traces the pill cleanly.
      // `outlineOffset: -2` keeps the ring inside the chip so it never
      // overlaps adjacent chips through the contentContainer's gap.
      focusable
      focusVisibleStyle={{
        outlineColor: '$focusRing',
        outlineWidth: 2,
        outlineStyle: 'solid',
        outlineOffset: -2,
      }}
      // Chips are nav targets, not text — drag/double-click should not
      // select the protocol name out of the strip.
      userSelect="none"
      alignItems="center"
      gap="$2"
      pl={CHIP_PADDING_LEFT}
      pr={CHIP_PADDING_RIGHT}
      py={CHIP_PADDING_Y}
      borderRadius="$full"
      borderCurve="continuous"
      bg={isActive ? '$bgPrimary' : '$bgSubdued'}
      // Scale carries the hover for both states (1.03 — tight enough to
      // read as a lift without flinching). The active chip can't shift
      // bg, since that would fight its $bgPrimary identity; the inactive
      // chip layers a $bgHover shift on top of the same scale so it gets
      // a second, quieter feedback channel. Press settles to 0.96 across
      // the strip — same tactile value as the chevron below — so the
      // click-feel reads as one gesture wherever it lands.
      hoverStyle={isActive ? { scale: 1.03 } : { bg: '$bgHover', scale: 1.03 }}
      pressStyle={{ scale: 0.96 }}
      // Reduced-motion users get instant state changes (bg, scale, focus
      // ring) instead of the quick fade — matches the same opt-out the
      // page scroller uses in DeFiContainer for `scrollTo`.
      animation={reducedMotion ? undefined : 'quick'}
    >
      <Stack
        borderRadius="$full"
        p={LOGO_HALO_PAD}
        bg={isActive ? '$textInverse' : 'transparent'}
      >
        <Token size="xs" tokenImageUri={logo} />
      </Stack>
      <SizableText
        size="$bodyMdMedium"
        color={isActive ? '$textInverse' : '$text'}
        numberOfLines={1}
        // Cap chip width so a long protocol name truncates cleanly instead
        // of stretching the strip beyond its natural scroll length.
        maxWidth={140}
      >
        {name}
      </SizableText>
    </XStack>
  );
}

const ProtocolChip = memo(ProtocolChipBase);
ProtocolChip.displayName = 'ProtocolChip';

// Web-only fade-in chevron sitting flush against one strip edge. Single
// definition for both sides; mirrors via `side` rather than duplicating
// the absolute-positioning + fade + IconButton boilerplate.
type IArrowAffordanceProps = {
  side: 'left' | 'right';
  visible: boolean;
  onPress: () => void;
};

function ArrowAffordance({ side, visible, onPress }: IArrowAffordanceProps) {
  const isLeft = side === 'left';
  return (
    <Stack
      position="absolute"
      top={0}
      bottom={0}
      zIndex={1}
      justifyContent="center"
      {...(isLeft
        ? { left: 0, pl: '$1', pr: '$4' }
        : { right: 0, pl: '$4', pr: '$1' })}
      opacity={visible ? 1 : 0}
      pointerEvents={visible ? 'auto' : 'none'}
      animation="quick"
      animateOnly={ANIMATE_ONLY_OPACITY}
      style={{ background: isLeft ? FADE_LEFT : FADE_RIGHT }}
    >
      <IconButton
        size="small"
        icon={isLeft ? 'ChevronLeftOutline' : 'ChevronRightOutline'}
        bg="$gray3"
        // Bg-shift alone carries the hover. The chevron is a 24px target
        // so layering scale on top of the bg change read as twitchy
        // here — the bg arc is enough signal. Press still depresses to
        // 0.96, the same value the chips use, so the click-feel is
        // identical no matter which surface in the strip the user hits.
        hoverStyle={{ bg: '$gray4' }}
        pressStyle={{ bg: '$gray5', scale: 0.96 }}
        animation="quick"
        onPress={onPress}
      />
    </Stack>
  );
}

type IProtocolChipStripProps = {
  protocols: IDeFiProtocol[];
  protocolMap: Record<string, IProtocolSummary>;
  activeKey: string | null;
  onPressChip: (protocol: IDeFiProtocol) => void;
  onHeightChange?: (height: number) => void;
  // 0 = strip hidden + offset upward, 1 = fully visible + at rest.
  // Written by the page's pin tracker each scroll frame so the emergence
  // tracks scroll progress 1:1.
  revealProgress: SharedValue<number>;
};

function ProtocolChipStripBase({
  protocols,
  protocolMap,
  activeKey,
  onPressChip,
  onHeightChange,
  revealProgress,
}: IProtocolChipStripProps) {
  const scrollViewRef = useRef<IScrollViewRef | null>(null);
  // Live DOM nodes for each chip, captured via React ref callback. We
  // measure with `getBoundingClientRect()` at recenter time rather than
  // caching `onLayout` coordinates because those coordinates are reported
  // relative to the chip's DOM parent, which is not the scroll container —
  // the resulting comparison against `el.scrollLeft` would silently fail
  // for any chip whose math depends on the horizontal padding of the
  // ScrollView's contentContainerStyle.
  const chipNodesRef = useRef<Map<string, HTMLElement>>(new Map());
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  // OS reduced-motion preference; mirrors DeFiContainer's page scroll so
  // the strip and the page agree on whether to animate.
  const reducedMotion = useReducedMotion();

  const animatedWrapperStyle = useAnimatedStyle(() => {
    'worklet';

    return {
      opacity: revealProgress.value,
      // Skip the slight upward slide on reduced motion — the opacity
      // fade alone still telegraphs the strip arriving / leaving.
      transform: reducedMotion
        ? []
        : [{ translateY: (revealProgress.value - 1) * REVEAL_TRANSLATE_PX }],
    };
  }, [reducedMotion]);

  // pointerEvents must travel through a React prop on the wrapper —
  // Animated.View's animatedProps path doesn't reliably forward it to the
  // underlying DOM/native node, which leaves the strip un-clickable while
  // it's mostly visible. Boolean state + useAnimatedReaction is one extra
  // setState per reveal threshold crossing — cheap, correct.
  const [interactive, setInteractive] = useState(false);
  useAnimatedReaction(
    () => revealProgress.value > 0.5,
    (next, prev) => {
      'worklet';

      if (next !== prev) runOnJS(setInteractive)(next);
    },
  );

  const getScrollEl = useCallback((): HTMLElement | null => {
    const node = scrollViewRef.current as
      | { getScrollableNode?: () => HTMLElement }
      | HTMLElement
      | null;
    if (!node) return null;
    if (
      typeof (node as { getScrollableNode?: () => HTMLElement })
        .getScrollableNode === 'function'
    ) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      return (
        node as { getScrollableNode: () => HTMLElement }
      ).getScrollableNode();
    }
    if (node instanceof HTMLElement) return node;
    return null;
  }, []);

  const updateArrows = useCallback(() => {
    const el = getScrollEl();
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setShowLeftArrow(scrollLeft > 1);
    setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 1);
  }, [getScrollEl]);

  // Mirror of activeKey readable from non-React contexts (the ref-set
  // callback below, the ResizeObserver) without re-creating callbacks on
  // every prop change. The assignment runs each render so the ref always
  // reflects the latest activeKey value the children would see.
  const activeKeyRef = useRef<string | null>(null);
  activeKeyRef.current = activeKey;

  // Two narrow gates that suppress recenter calls with reason 'auto' only;
  // 'activeKey' recenter calls bypass both. `recentStripScrollRef` is held
  // for STRIP_SCROLL_GRACE_MS after the strip's own scrollLeft changes;
  // `isFocusInsideRef` mirrors keyboard focus-within.
  //
  // We *deliberately* do not key engagement off pointer hover. The strip
  // is sticky at the viewport top, so the cursor can sit motionless
  // inside its hit area through unbounded amounts of vertical page
  // scroll. Worse, browsers fire synthetic `pointermove` events on
  // hover-tracked elements during page scroll to keep `:hover` fresh —
  // those keep resetting any move-driven engagement timer indefinitely.
  // Either approach traps the gate latched-on whenever the user happens
  // to leave their cursor over the bar, which is the "strip frozen
  // during page scroll until I click somewhere" bug.
  //
  // Refs (not state) because the listeners reading them are stable across
  // renders, and flipping these must not cascade into a re-render — a
  // re-render would re-run the recenter useLayoutEffect and defeat the
  // suppression.
  const recentStripScrollRef = useRef(false);
  const isFocusInsideRef = useRef(false);

  // Held in a ref so the merged scroll listener can stay attached through
  // every activeKey change without tear-down/re-attach churn — the latest
  // closure (with current activeKey) is plumbed in via the assignment
  // below, which runs on every render.
  const recenterIfNeededRef = useRef<(reason?: IRecenterReason) => void>(
    () => {},
  );
  recenterIfNeededRef.current = (reason = 'auto') => {
    if (platformEnv.isNative || !activeKey) return;
    // 'activeKey' bypasses gates because the user is reading the page,
    // not the strip — suppressing here produced the "strip frozen during
    // page scroll" bug.
    if (
      reason === 'auto' &&
      (recentStripScrollRef.current || isFocusInsideRef.current)
    ) {
      return;
    }
    const chipNode = chipNodesRef.current.get(activeKey);
    if (!chipNode || !chipNode.isConnected) return;
    const el = getScrollEl();
    if (!el) return;
    // Live geometry. Compared in viewport coordinates (both rects come from
    // getBoundingClientRect), which is the only frame the chip and the
    // scrollable element are guaranteed to share regardless of how many
    // wrappers RNW or Tamagui interpose between them.
    const chipRect = chipNode.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    if (
      isChipFullyVisible({
        chipLeft: chipRect.left,
        chipWidth: chipRect.width,
        scrollLeft: elRect.left,
        viewportWidth: elRect.width,
        tolerancePx: VISIBILITY_TOLERANCE_PX,
      })
    ) {
      return;
    }
    // The browser owns the centering math, scroll-bounds clamping, and
    // animation. `inline: 'center'` targets the chip's nearest
    // horizontally-scrollable ancestor (the strip); `block: 'nearest'`
    // is a no-op vertically because the chip sits inside a sticky bar
    // that's always vertically visible.
    chipNode.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  };

  // One scroll listener does both arrow visibility (sync) and active-chip
  // recenter (debounced). Two separate listeners would each tear down +
  // re-attach on every activeKey change, since their callback identities
  // would depend on activeKey.
  useEffect(() => {
    if (platformEnv.isNative) return undefined;
    const el = getScrollEl();
    if (!el) return undefined;

    let stripScrollGraceTimer: ReturnType<typeof setTimeout> | null = null;

    // Closes the strip-scroll grace window. State cleanup only — no
    // catch-up recenter. Once the user has scrolled the strip themselves
    // (drag, wheel, arrow button), that position is theirs until the
    // next activeKey change. Snapping back on touch-end / mouse-release
    // read as the strip fighting the user — they'd drag, lift, and
    // watch it slide back to where it was. activeKey-triggered
    // centering updates still fire through their own path because they bypass
    // this gate; navigation between protocols still anchors correctly.
    const releaseScrollGate = () => {
      if (stripScrollGraceTimer) {
        clearTimeout(stripScrollGraceTimer);
        stripScrollGraceTimer = null;
      }
      recentStripScrollRef.current = false;
    };

    const onScroll = () => {
      updateArrows();
      // The strip's own scrollLeft changed — wheel pagination, arrow
      // button, programmatic scrollIntoView, etc. Open the snap-back
      // grace window. Vertical wheel over the strip does NOT fire this
      // (browsers don't redirect vertical wheel into horizontal
      // scroll containers), which is intentional: vertical wheel means page
      // navigation, not strip engagement.
      recentStripScrollRef.current = true;
      if (stripScrollGraceTimer) clearTimeout(stripScrollGraceTimer);
      stripScrollGraceTimer = setTimeout(
        releaseScrollGate,
        STRIP_SCROLL_GRACE_MS,
      );
    };
    el.addEventListener('scroll', onScroll, { passive: true });

    // Pointer events (not mouseenter/leave) so touch + pen + mouse all
    // funnel through one code path. We listen ONLY to pointerleave and
    // not to enter/move: enter/move are unreliable here (synthetic
    // pointermove during page scroll keeps firing on the sticky strip
    // because :hover bookkeeping demands it, which would re-arm any
    // engagement timer indefinitely). pointerleave still fires correctly
    // when the cursor genuinely exits the strip, which is when we want
    // to short-circuit the grace window early.
    el.addEventListener('pointerleave', releaseScrollGate);

    // focusin/focusout (not focus/blur) so they bubble up from chip
    // children to the scroll container. Tabbing between two chips inside
    // the strip emits focusout-then-focusin in the same tick;
    // `relatedTarget` is the chip receiving focus, so containing it inside
    // `el` means focus stayed inside the strip — don't release the gate
    // and don't recenter, or the chip the user just tabbed to would slide
    // out from under them.
    const onFocusIn = () => {
      isFocusInsideRef.current = true;
    };
    const onFocusOut = (e: FocusEvent) => {
      const next = e.relatedTarget as Node | null;
      if (next && el.contains(next)) return;
      isFocusInsideRef.current = false;
      recenterIfNeededRef.current();
    };
    el.addEventListener('focusin', onFocusIn);
    el.addEventListener('focusout', onFocusOut);

    const observer = new ResizeObserver(() => {
      updateArrows();
      // Strip/viewport width changed (window resize, drawer toggle, font
      // scale). The active chip can have fallen outside the new visible
      // band even though activeKey hasn't changed, so the activeKey-driven
      // recenter effect won't fire. Recenter here as the only signal the
      // strip geometry has shifted.
      recenterIfNeededRef.current();
    });
    observer.observe(el);
    updateArrows();
    return () => {
      el.removeEventListener('scroll', onScroll);
      el.removeEventListener('pointerleave', releaseScrollGate);
      el.removeEventListener('focusin', onFocusIn);
      el.removeEventListener('focusout', onFocusOut);
      observer.disconnect();
      if (stripScrollGraceTimer) clearTimeout(stripScrollGraceTimer);
    };
    // protocols.length is intentionally a dep: scroll geometry needs a
    // re-eval when the chip count changes.
  }, [getScrollEl, updateArrows, protocols.length]);

  // useLayoutEffect (not useEffect): the scrollIntoView call has to be
  // dispatched before the browser paints the new highlight, otherwise
  // the active chip flashes off-screen for one frame on long jumps.
  useLayoutEffect(() => {
    recenterIfNeededRef.current('activeKey');
  }, [activeKey]);

  const scrollByPage = useCallback(
    (direction: 1 | -1) => {
      const el = getScrollEl();
      if (!el) return;
      el.scrollBy({
        left: direction * el.clientWidth * ARROW_PAGE_FRACTION,
        behavior: reducedMotion ? 'auto' : 'smooth',
      });
    },
    [getScrollEl, reducedMotion],
  );
  const handleScrollLeft = useCallback(() => scrollByPage(-1), [scrollByPage]);
  const handleScrollRight = useCallback(() => scrollByPage(1), [scrollByPage]);

  // Stable across all renders — passed to memoized chips so only the
  // toggling chips (newly active + previously active) re-render on
  // activeKey change. The ref callback fires synchronously during commit
  // (mount, key change, unmount), so by the time the activeKey
  // useLayoutEffect runs the active chip's node is already in the map.
  const handleChipNodeRef = useCallback(
    (key: string, node: HTMLElement | null) => {
      if (node) {
        chipNodesRef.current.set(key, node);
      } else {
        chipNodesRef.current.delete(key);
      }
      // If this chip's node arrived *after* it was already selected as
      // the active chip (concurrent rendering, mount during scroll), the
      // activeKey useLayoutEffect ran but bailed because the node was
      // missing. Re-fire as a continuation of that effect.
      if (node && key === activeKeyRef.current) {
        recenterIfNeededRef.current('activeKey');
      }
    },
    [],
  );

  const chips = useMemo(
    () =>
      protocols.map((p) => {
        const key = defiUtils.buildProtocolMapKey({
          protocol: p.protocol,
          networkId: p.networkId,
        });
        const display = buildProtocolDisplayInfo({
          protocol: p,
          protocolInfo: protocolMap[key],
        });
        return {
          key,
          name: display.protocolName,
          logo: display.protocolLogo,
          protocol: p,
        };
      }),
    [protocols, protocolMap],
  );

  return (
    <Animated.View
      style={animatedWrapperStyle}
      pointerEvents={interactive ? 'auto' : 'none'}
    >
      <YStack
        bg="$bgApp"
        position="relative"
        borderBottomWidth={StyleSheet.hairlineWidth}
        borderBottomColor="$borderSubdued"
        py={STRIP_PADDING_Y}
        onLayout={(e) => onHeightChange?.(e.nativeEvent.layout.height)}
      >
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            px: '$pagePadding',
            gap: CHIP_GAP,
            alignItems: 'center',
          }}
        >
          {chips.map((chip) => (
            <ProtocolChip
              key={chip.key}
              chipKey={chip.key}
              protocol={chip.protocol}
              name={chip.name}
              logo={chip.logo}
              isActive={chip.key === activeKey}
              reducedMotion={reducedMotion}
              onPress={onPressChip}
              onNodeRef={handleChipNodeRef}
            />
          ))}
        </ScrollView>
        {!platformEnv.isNative ? (
          <>
            <ArrowAffordance
              side="left"
              visible={showLeftArrow}
              onPress={handleScrollLeft}
            />
            <ArrowAffordance
              side="right"
              visible={showRightArrow}
              onPress={handleScrollRight}
            />
          </>
        ) : null}
      </YStack>
    </Animated.View>
  );
}

const ProtocolChipStrip = memo(ProtocolChipStripBase);
ProtocolChipStrip.displayName = 'ProtocolChipStrip';

export { ProtocolChipStrip };
export type { IProtocolChipStripProps };
