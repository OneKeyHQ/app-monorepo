import { useCallback, useEffect, useRef, useState } from 'react';

import { StyleSheet } from 'react-native';

import { Icon, Stack, XStack } from '@onekeyhq/components';

const DISMISS_GUARD_DELAY = 350;
const SHOW_DELAY = 500;

type IInlineActionBarProps = {
  isFirstItem: boolean;
  onMoveToTop: () => void;
  onToggleWatchlist: () => void;
  onDismiss: () => void;
};

function InlineActionBar({
  isFirstItem,
  onMoveToTop,
  onToggleWatchlist,
  onDismiss,
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
        alignSelf="center"
        top="45%"
        width={84}
        height={42}
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
