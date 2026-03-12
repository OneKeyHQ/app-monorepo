import { useCallback, useEffect, useRef, useState } from 'react';

import { Dimensions, StyleSheet } from 'react-native';

import { Icon, Stack, XStack } from '@onekeyhq/components';

const DISMISS_GUARD_DELAY = 350;
const SHOW_DELAY = 500;

type IInlineActionBarProps = {
  isFirstItem: boolean;
  onMoveToTop: () => void;
  onToggleWatchlist: () => void;
  onDismiss: () => void;
  anchor?: {
    x: number;
    y: number;
  };
};

const ACTION_BAR_WIDTH = 84;
const ACTION_BAR_HEIGHT = 42;
const ACTION_BAR_SAFE_MARGIN = 16;

function InlineActionBar({
  isFirstItem,
  onMoveToTop,
  onToggleWatchlist,
  onDismiss,
  anchor,
}: IInlineActionBarProps) {
  // Delay showing the action bar so it doesn't appear while the finger
  // is still on screen after a long-press / drag gesture
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, SHOW_DELAY);
    return () => clearTimeout(timer);
  }, []);

  // Guard against immediate dismiss from the long-press touch-up event
  // bubbling into the backdrop onPress
  const isReadyRef = useRef(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      isReadyRef.current = true;
    }, DISMISS_GUARD_DELAY);
    return () => clearTimeout(timer);
  }, []);

  const handleBackdropPress = useCallback(() => {
    if (!isReadyRef.current) return;
    onDismiss();
  }, [onDismiss]);

  const handleMoveToTop = useCallback(() => {
    if (isFirstItem) return;
    onMoveToTop();
  }, [isFirstItem, onMoveToTop]);

  const handleToggleWatchlist = useCallback(() => {
    onToggleWatchlist();
  }, [onToggleWatchlist]);

  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const top = Math.max(
    ACTION_BAR_SAFE_MARGIN,
    Math.min(
      (anchor?.y ?? screenHeight * 0.45) - ACTION_BAR_HEIGHT / 2,
      screenHeight - ACTION_BAR_SAFE_MARGIN - ACTION_BAR_HEIGHT,
    ),
  );
  const left = Math.max(
    ACTION_BAR_SAFE_MARGIN,
    Math.min(
      (anchor?.x ?? screenWidth / 2) - ACTION_BAR_WIDTH / 2,
      screenWidth - ACTION_BAR_SAFE_MARGIN - ACTION_BAR_WIDTH,
    ),
  );

  return (
    <Stack
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      zIndex={9999}
      onPress={handleBackdropPress}
    >
      {/* Centered action bar */}
      <XStack
        position="absolute"
        top={top}
        left={left}
        width={ACTION_BAR_WIDTH}
        height={ACTION_BAR_HEIGHT}
        borderRadius="$2"
        alignItems="center"
        justifyContent="center"
        opacity={isVisible ? 1 : 0}
        style={{ backgroundColor: 'rgba(0,0,0,0.27)' }}
      >
        {/* Move to top button */}
        <Stack
          width={42}
          height={42}
          alignItems="center"
          justifyContent="center"
          opacity={isFirstItem ? 0.3 : 1}
          onPress={(e) => {
            e.stopPropagation();
            handleMoveToTop();
          }}
        >
          <Icon name="AlignTopOutline" size="$5" color="$whiteA12" />
        </Stack>

        {/* Divider */}
        <Stack
          height={20}
          style={{
            width: StyleSheet.hairlineWidth,
            backgroundColor: 'rgba(255,255,255,0.3)',
          }}
        />

        {/* Toggle watchlist button */}
        <Stack
          width={42}
          height={42}
          alignItems="center"
          justifyContent="center"
          onPress={(e) => {
            e.stopPropagation();
            handleToggleWatchlist();
          }}
        >
          <Icon name="StarSolid" size="$5" color="$iconCaution" />
        </Stack>
      </XStack>
    </Stack>
  );
}

export { InlineActionBar };
