import { memo, useCallback, useEffect, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Button, SizableText, Toast, XStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { AssetDetailsTestIDs } from '../../testIDs';

type IProps = {
  accountId: string;
  networkId: string;
  symbol: string;
  pendingReceiveSats?: string;
  onRefresh: () => void;
};

// Lightning on Spark: sats paid to the account while its wallet was offline
// wait until the wallet claims them. This page claims them silently when the
// password is cached; the button claims them otherwise.
function TokenDetailsSparkClaim({
  accountId,
  networkId,
  symbol,
  pendingReceiveSats,
  onRefresh,
}: IProps) {
  const intl = useIntl();
  const [isClaiming, setIsClaiming] = useState(false);
  // The SDK sync of a claim returns even when a part of it failed, so the
  // claim counts as done only once the refreshed account data shows no
  // pending amount.
  const [isClaimUnconfirmed, setIsClaimUnconfirmed] = useState(false);
  const hasPendingReceive =
    !!pendingReceiveSats && new BigNumber(pendingReceiveSats).gt(0);

  // The background updates account data once a claim or payment lands.
  useEffect(() => {
    const refresh = () => onRefresh();
    appEventBus.on(EAppEventBusNames.AccountDataUpdate, refresh);
    return () => {
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, refresh);
    };
  }, [onRefresh]);

  useEffect(() => {
    if (isClaimUnconfirmed && !hasPendingReceive) {
      setIsClaimUnconfirmed(false);
      Toast.success({
        title: intl.formatMessage({ id: ETranslations.earn_claimed }),
      });
    }
  }, [hasPendingReceive, intl, isClaimUnconfirmed]);

  const handleClaim = useCallback(async () => {
    setIsClaiming(true);
    try {
      await backgroundApiProxy.serviceLightningSpark.claimPendingReceive({
        accountId,
        networkId,
      });
      setIsClaimUnconfirmed(true);
    } finally {
      setIsClaiming(false);
    }
  }, [accountId, networkId]);

  if (!hasPendingReceive) {
    return null;
  }

  return (
    <XStack alignItems="center" justifyContent="space-between" gap="$3" mb="$5">
      <XStack gap="$1" flexShrink={1}>
        <SizableText size="$bodyMd" color="$textSuccess">
          {intl.formatMessage({ id: ETranslations.earn_claimable })}
        </SizableText>
        <NumberSizeableTextWrapper
          hideValue
          formatter="balance"
          formatterOptions={{ tokenSymbol: symbol }}
          size="$bodyMd"
          color="$textSuccess"
        >
          {pendingReceiveSats}
        </NumberSizeableTextWrapper>
      </XStack>
      <Button
        testID={AssetDetailsTestIDs.sparkClaimBtn}
        size="small"
        variant="primary"
        loading={isClaiming}
        onPress={handleClaim}
      >
        {intl.formatMessage({ id: ETranslations.earn_claim })}
      </Button>
    </XStack>
  );
}

export default memo(TokenDetailsSparkClaim);
