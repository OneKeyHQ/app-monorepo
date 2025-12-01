import { useCallback, useEffect } from 'react';

import { useIntl } from 'react-intl';

import { Badge, Button, IconButton, Stack, XStack } from '@onekeyhq/components';
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
    appNavigation.setOptions({
      headerRight,
    });
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
