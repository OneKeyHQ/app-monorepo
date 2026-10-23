import {
  AnimatePresence,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ANIMATE_ONLY_OPACITY } from '@onekeyhq/components/src/utils/animationConstants';

const HIDDEN_STYLE = { opacity: 0 } as const;
// A figure being worked out again stays at this opacity until the new one
const STALE_OPACITY = 0.4;

// Under an amount box: what the typed amount turns into (what reaches the
// vault, the tokens bought). One box to type in, so the form reads as one
// action rather than a swap between two boxes
export function StakingAmountResultLine({
  label,
  value,
  loading,
  isPlaceholder,
  testID,
}: {
  label: string;
  value: string;
  // A new figure on its way: the last one dims, or with none yet a
  // placeholder its size holds the place
  loading?: boolean;
  // Nothing typed or quoted yet: grey, as the box's own "0" is
  isPlaceholder?: boolean;
  testID?: string;
}) {
  const showsPlaceholder = Boolean(loading && isPlaceholder);
  return (
    <XStack testID={testID} px="$3.5" gap="$3" ai="center" jc="space-between">
      <SizableText size="$bodyMd" color="$textSubdued" flexShrink={0}>
        {label}
      </SizableText>
      <XStack position="relative" flexShrink={1} jc="flex-end" minHeight={20}>
        {/* The placeholder sits where the figure goes and fades out as it
            fades in */}
        <AnimatePresence>
          {showsPlaceholder ? (
            <YStack
              key="placeholder"
              position="absolute"
              right={0}
              top={0}
              bottom={0}
              jc="center"
              transition="quick"
              animateOnly={ANIMATE_ONLY_OPACITY}
              enterStyle={HIDDEN_STYLE}
              exitStyle={HIDDEN_STYLE}
            >
              <Skeleton.BodyMd w={96} />
            </YStack>
          ) : null}
        </AnimatePresence>
        {showsPlaceholder ? null : (
          <XStack
            key={value}
            transition="quick"
            animateOnly={ANIMATE_ONLY_OPACITY}
            enterStyle={HIDDEN_STYLE}
            opacity={loading ? STALE_OPACITY : 1}
            flexShrink={1}
          >
            <SizableText
              size="$bodyMdMedium"
              color={isPlaceholder ? '$textDisabled' : undefined}
              textAlign="right"
              numberOfLines={1}
              flexShrink={1}
            >
              {value}
            </SizableText>
          </XStack>
        )}
      </XStack>
    </XStack>
  );
}
