import type { ReactNode } from 'react';

import { SizableText, Spinner, XStack, useMedia } from '@onekeyhq/components';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { useSettingsValuePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { WrappedActionButton } from '../PortfolioTabContent';

import { buildKeyboardPressProps } from './earnDesktopPressable';

import type { IEarnDesktopTileRow } from './earnDesktopHome.utils';

function PillFrame({
  testID,
  isText,
  disabled,
  onPress,
  children,
}: {
  testID: string;
  isText?: boolean;
  disabled?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  const media = useMedia();
  const press = disabled ? undefined : onPress;
  return (
    <XStack
      testID={testID}
      role="button"
      ai="center"
      gap="$2"
      // The height of the secondary buttons this row had
      h={media.gtMd ? 36 : 32}
      pl={isText ? '$3.5' : '$1.5'}
      pr="$3.5"
      borderRadius="$full"
      borderCurve="continuous"
      bg="$bgStrong"
      hoverStyle={{ bg: '$bgStrongHover' }}
      pressStyle={{ bg: '$bgStrongActive' }}
      cursor={disabled ? 'not-allowed' : 'pointer'}
      userSelect="none"
      onPress={press}
      {...buildKeyboardPressProps(press)}
    >
      {children}
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
        >
          <SizableText size="$bodyMdMedium">{`+${moreCount}`}</SizableText>
        </PillFrame>
      ) : null}
    </XStack>
  );
}
