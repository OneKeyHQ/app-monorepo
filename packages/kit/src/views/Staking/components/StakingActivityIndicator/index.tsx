import { useCallback, useEffect } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  Button,
  IconButton,
  Stack,
  XStack,
  toNoGlassHeaderItems,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  IEarnHistoryActionIcon,
  IStakeTag,
} from '@onekeyhq/shared/types/staking';

import { useStakingPendingTxs } from '../../../Earn/hooks/useStakingPendingTxs';

type IStakingActivityIndicatorProps = {
  num: number;
  onPress?: () => void;
  historyAction?: IEarnHistoryActionIcon;
  shareUrl?: string;
  onShare?: () => void;
};

export const PendingIndicator = ({
  num,
  onPress,
}: Pick<IStakingActivityIndicatorProps, 'num' | 'onPress'>) => {
  const intl = useIntl();
  return (
    <Stack cursor={onPress ? 'pointer' : 'default'}>
      <Badge badgeType="info" badgeSize="lg" onPress={onPress}>
        <Stack borderRadius="$full" p={3} bg="$borderInfo">
          <Stack w="$1.5" h="$1.5" borderRadius="$full" bg="$iconInfo" />
        </Stack>
        <Badge.Text pl="$2">
          {num > 1
            ? `${num} ${intl.formatMessage({
                id: ETranslations.global_pending,
              })} `
            : intl.formatMessage({ id: ETranslations.global_pending })}
        </Badge.Text>
      </Badge>
    </Stack>
  );
};

const StakingActivityIndicator = ({
  num,
  onPress,
  historyAction,
  shareUrl,
  onShare,
}: IStakingActivityIndicatorProps) => {
  const appNavigation = useAppNavigation();
  const headerRight = useCallback(() => {
    if (num > 0) {
      return (
        <XStack gap="$4" alignItems="center">
          <PendingIndicator num={num} onPress={onPress} />
          {shareUrl && onShare ? (
            <IconButton
              testID="staking-header-right-icon-btn"
              icon="ShareOutline"
              variant="tertiary"
              size="medium"
              onPress={onShare}
            />
          ) : null}
        </XStack>
      );
    }
    if ((historyAction && onPress) || (shareUrl && onShare)) {
      return (
        <XStack gap="$4" alignItems="center">
          {historyAction && onPress ? (
            <Button
              testID="staking-header-right-btn"
              variant="tertiary"
              size="medium"
              disabled={historyAction.disabled}
              onPress={onPress}
            >
              {historyAction.text.text}
            </Button>
          ) : null}
          {shareUrl && onShare ? (
            <IconButton
              testID="staking-icon-btn"
              icon="ShareOutline"
              variant="tertiary"
              size="medium"
              onPress={onShare}
            />
          ) : null}
        </XStack>
      );
    }
    return null;
  }, [historyAction, num, onPress, shareUrl, onShare]);
  useEffect(() => {
    // This header is multi-child (pending badge / text Button + share icon),
    // not a single icon button, so on iOS 26 drop the glass capsule — otherwise
    // it renders as a wide pill with the button's own press style showing
    // through. toNoGlassHeaderItems returns undefined off iOS 26, so the
    // classic headerRight is used everywhere else.
    const noGlassItems = toNoGlassHeaderItems(headerRight);
    appNavigation.setOptions(
      noGlassItems
        ? { headerRight: undefined, unstable_headerRightItems: noGlassItems }
        : { headerRight },
    );
  }, [appNavigation, headerRight, num]);
  return null;
};

export const StakingTransactionIndicator = ({
  accountId,
  networkId,
  stakeTag,
  onRefresh,
  onPress,
  historyAction,
  shareUrl,
  onShare,
}: {
  accountId?: string;
  networkId: string;
  stakeTag: IStakeTag;
  onRefresh?: () => void;
  onPress?: () => void;
  historyAction?: IEarnHistoryActionIcon;
  shareUrl?: string;
  onShare?: () => void;
}) => {
  const { pendingCount } = useStakingPendingTxs({
    accountId,
    networkId,
    stakeTag,
    onRefresh,
  });

  return (
    <StakingActivityIndicator
      num={pendingCount}
      onPress={onPress}
      historyAction={historyAction}
      shareUrl={shareUrl}
      onShare={onShare}
    />
  );
};
