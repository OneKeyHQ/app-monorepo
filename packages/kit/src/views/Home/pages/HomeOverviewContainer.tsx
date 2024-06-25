import { useEffect, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  IconButton,
  NumberSizeableText,
  Skeleton,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  POLLING_DEBOUNCE_INTERVAL,
  POLLING_INTERVAL_FOR_TOTAL_VALUE,
} from '@onekeyhq/shared/src/consts/walletConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { showBalanceDetailsDialog } from '../components/BalanceDetailsDialog';

import type { FontSizeTokens } from 'tamagui';

function HomeOverviewContainer() {
  const intl = useIntl();
  const num = 0;
  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num });

  const [overviewState, setOverviewState] = useState({
    initialized: false,
    isRefreshing: false,
  });

  const [settings] = useSettingsPersistAtom();

  const { result: overview } = usePromiseResult(
    async () => {
      if (!account || !network) return;
      const accountAddress =
        await backgroundApiProxy.serviceAccount.getAccountAddressForApi({
          accountId: account.id,
          networkId: network.id,
        });
      const r =
        await backgroundApiProxy.serviceAccountProfile.fetchAccountDetails({
          networkId: network.id,
          accountAddress,
          xpub: await backgroundApiProxy.serviceAccount.getAccountXpub({
            accountId: account.id,
            networkId: network.id,
          }),
          withNetWorth: true,
          withNonce: false,
        });
      setOverviewState({
        initialized: true,
        isRefreshing: false,
      });
      return r;
    },
    [account, network],
    {
      debounced: POLLING_DEBOUNCE_INTERVAL,
      pollingInterval: POLLING_INTERVAL_FOR_TOTAL_VALUE,
    },
  );

  const { result: vaultSettings } = usePromiseResult(async () => {
    if (!network) return;
    const s = backgroundApiProxy.serviceNetwork.getVaultSettings({
      networkId: network.id,
    });
    return s;
  }, [network]);

  useEffect(() => {
    if (account?.id && network?.id && wallet?.id) {
      setOverviewState({
        initialized: false,
        isRefreshing: true,
      });
    }
  }, [account?.id, network?.id, wallet?.id]);
  const { md } = useMedia();

  if (overviewState.isRefreshing && !overviewState.initialized)
    return (
      <Stack py="$2.5">
        <Skeleton w="$40" h="$7" my="$2.5" />
      </Stack>
    );

  const balanceString = overview?.netWorth ?? '0';
  const balanceSizeList: { length: number; size: FontSizeTokens }[] = [
    { length: 25, size: '$headingXl' },
    { length: 13, size: '$heading4xl' },
  ];
  const defaultBalanceSize = '$heading5xl';
  const numberFormatter: INumberFormatProps = {
    formatter: 'value',
    formatterOptions: { currency: settings.currencyInfo.symbol },
  };

  return (
    <XStack alignItems="center" space="$2">
      <NumberSizeableText
        flex={1}
        minWidth={0}
        {...numberFormatter}
        size={
          md
            ? balanceSizeList.find(
                (item) =>
                  numberFormat(String(balanceString), numberFormatter, true)
                    .length >= item.length,
              )?.size ?? defaultBalanceSize
            : defaultBalanceSize
        }
      >
        {balanceString}
      </NumberSizeableText>
      {vaultSettings?.hasFrozenBalance ? (
        <IconButton
          title={intl.formatMessage({
            id: ETranslations.balance_detail_button_balance,
          })}
          icon="InfoCircleOutline"
          variant="tertiary"
          onPressDebounce={200}
          onPress={() =>
            showBalanceDetailsDialog({
              accountId: account?.id ?? '',
              networkId: network?.id ?? '',
            })
          }
        />
      ) : null}
    </XStack>
  );
}

export { HomeOverviewContainer };
