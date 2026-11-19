import type { ReactNode } from 'react';

import { useReducedMotion } from 'react-native-reanimated';

import {
  SizableText,
  Skeleton,
  Spinner,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { getSharedButtonStyles } from '@onekeyhq/components/src/primitives/Button';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { useSettingsValuePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { WrappedActionButton } from '../PortfolioTabContent';

import { ANIMATE_ONLY_BG_COLOR } from './earnDesktopColorEase';
import { buildKeyboardPressProps } from './earnDesktopPressable';
import { warmEarnPositions } from './earnDesktopWarm';

import type { IEarnDesktopTileRow } from './earnDesktopHome.utils';

// The height of the secondary buttons this row had
export const getRewardPillHeight = (isWide: boolean) => (isWide ? 36 : 32);
// Claim is a Secondary button: its colors, in the pill's shape
const { sharedFrameStyles: SECONDARY_STYLES } = getSharedButtonStyles({
  variant: 'secondary',
});
const SECONDARY_HOVER_STYLE =
  'hoverStyle' in SECONDARY_STYLES ? SECONDARY_STYLES.hoverStyle : undefined;
const SECONDARY_PRESS_STYLE =
  'pressStyle' in SECONDARY_STYLES ? SECONDARY_STYLES.pressStyle : undefined;

function PillFrame({
  testID,
  isText,
  disabled,
  onPress,
  onWarm,
  children,
}: {
  testID: string;
  isText?: boolean;
  disabled?: boolean;
  onPress: () => void;
  /** Loads what the press opens, while the pill is pointed at or focused */
  onWarm?: () => void;
  children: ReactNode;
}) {
  const media = useMedia();
  const reduceMotion = useReducedMotion();
  const press = disabled ? undefined : onPress;
  return (
    <XStack
      testID={testID}
      role="button"
      ai="center"
      gap="$2"
      h={getRewardPillHeight(media.gtMd)}
      pl={isText ? '$3.5' : '$1.5'}
      pr="$3.5"
      borderRadius="$full"
      borderCurve="continuous"
      bg={SECONDARY_STYLES.bg}
      hoverStyle={SECONDARY_HOVER_STYLE}
      pressStyle={SECONDARY_PRESS_STYLE}
      transition={reduceMotion ? undefined : 'quick'}
      animateOnly={ANIMATE_ONLY_BG_COLOR}
      cursor={disabled ? 'not-allowed' : 'pointer'}
      userSelect="none"
      onPress={press}
      onHoverIn={onWarm}
      onFocus={onWarm}
      {...buildKeyboardPressProps(press)}
    >
      {children}
    </XStack>
  );
}

/** The row's place while the hero loads: pills of its height, no words */
export function EarnDesktopRewardPillsSkeleton() {
  const media = useMedia();
  const height = getRewardPillHeight(media.gtMd);
  return (
    <XStack testID="earn-desktop-reward-pills-placeholder" gap="$2">
      <Skeleton w={176} h={height} radius="round" />
      {media.gtMd ? <Skeleton w={196} h={height} radius="round" /> : null}
    </XStack>
  );
}

// "Claim 0.52 MORPHO": the reward's own button, with what it pays
function RewardPill({ row }: { row: IEarnDesktopTileRow }) {
  const [{ hideValue }] = useSettingsValuePersistAtom();
  const { action } = row;
  if (!action) {
    return null;
  }
  const renderTrigger = ({
    onPress,
    loading,
    disabled,
    text,
  }: {
    onPress: () => void;
    loading: boolean;
    disabled: boolean;
    text: Parameters<typeof EarnText>[0]['text'];
  }) => (
    <PillFrame
      testID={`earn-desktop-reward-pill-${row.key}`}
      disabled={disabled}
      onPress={onPress}
    >
      {loading ? (
        <XStack w="$6" h="$6" ai="center" jc="center">
          <Spinner size="small" />
        </XStack>
      ) : (
        <Token
          size="sm"
          tokenImageUri={row.logoURI}
          showNetworkIcon
          networkId={row.networkId}
        />
      )}
      <EarnText text={text} size="$bodyMdMedium" />
      {row.amount === undefined ? (
        <EarnText
          text={hideValue ? { text: '****' } : row.title}
          size="$bodyMdMedium"
          numberOfLines={1}
        />
      ) : (
        <NumberSizeableTextWrapper
          hideValue
          size="$bodyMdMedium"
          formatter="balance"
          formatterOptions={{ tokenSymbol: row.symbol }}
          numberOfLines={1}
        >
          {row.amount}
        </NumberSizeableTextWrapper>
      )}
    </PillFrame>
  );
  if (action.source === 'airdrop') {
    return (
      <WrappedActionButton
        asset={action.asset}
        reward={action.reward}
        claimSourceIdentity={action.claimSourceIdentity}
        rewardSymbol={action.rewardSymbol}
        renderTrigger={renderTrigger}
      />
    );
  }
  return (
    <WrappedActionButton
      asset={action.asset}
      reward={action.reward}
      rewardSymbol={action.rewardSymbol}
      renderTrigger={renderTrigger}
    />
  );
}

/**
 * The rewards waiting to be claimed, under the net worth: a pill each, the
 * largest first, pressed to claim; the rest are counted in a last pill that
 * opens My portfolio
 */
export function EarnDesktopRewardPills({
  rows,
  onOpenMore,
}: {
  rows: IEarnDesktopTileRow[];
  onOpenMore: () => void;
}) {
  const media = useMedia();
  if (!rows.length) {
    return null;
  }
  const shown = rows.slice(0, media.gtMd ? 2 : 1);
  const moreCount = rows.length - shown.length;
  return (
    <XStack gap="$2" flexWrap="wrap">
      {shown.map((row) => (
        <RewardPill key={row.key} row={row} />
      ))}
      {moreCount > 0 ? (
        <PillFrame
          testID="earn-desktop-reward-pills-more"
          isText
          onPress={onOpenMore}
          onWarm={warmEarnPositions}
        >
          <SizableText size="$bodyMdMedium">{`+${moreCount}`}</SizableText>
        </PillFrame>
      ) : null}
    </XStack>
  );
}
