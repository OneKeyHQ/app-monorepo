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

  // The background updates account data once a claim or payment lands.
  useEffect(() => {
    const refresh = () => onRefresh();
    appEventBus.on(EAppEventBusNames.AccountDataUpdate, refresh);
    return () => {
      appEventBus.off(EAppEventBusNames.AccountDataUpdate, refresh);
    };
  }, [onRefresh]);

  const handleClaim = useCallback(async () => {
    setIsClaiming(true);
    try {
      await backgroundApiProxy.serviceLightningSpark.claimPendingReceive({
        accountId,
        networkId,
      });
      Toast.success({
        title: intl.formatMessage({ id: ETranslations.earn_claimed }),
      });
    } finally {
      setIsClaiming(false);
    }
  }, [accountId, intl, networkId]);

  if (!pendingReceiveSats || new BigNumber(pendingReceiveSats).lte(0)) {
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
