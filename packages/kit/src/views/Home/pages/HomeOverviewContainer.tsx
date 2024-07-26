import { useEffect, useRef } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Icon,
  IconButton,
  NumberSizeableText,
  Skeleton,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import type { IDialogInstance } from '@onekeyhq/components';
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
import {
  useAccountOverviewActions,
  useAccountOverviewStateAtom,
  useAccountWorthAtom,
} from '../../../states/jotai/contexts/accountOverview';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { showBalanceDetailsDialog } from '../components/BalanceDetailsDialog';

import type { FontSizeTokens } from 'tamagui';

function HomeOverviewContainer() {
  const intl = useIntl();
  const num = 0;
  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num });

  const [accountWorth] = useAccountWorthAtom();
  const [overviewState] = useAccountOverviewStateAtom();
  const { updateAccountOverviewState, updateAccountWorth } =
    useAccountOverviewActions().current;

  const [settings] = useSettingsPersistAtom();

  const { result: overview } = usePromiseResult(
    async () => {
      if (!account || !network) return;
      if (network.isAllNetworks) return;
      await backgroundApiProxy.serviceAccountProfile.abortFetchAccountDetails();
      const r =
        await backgroundApiProxy.serviceAccountProfile.fetchAccountDetails({
          networkId: network.id,
          accountId: account.id,
          withNetWorth: true,
          withNonce: false,
        });
      updateAccountOverviewState({
        initialized: true,
        isRefreshing: false,
      });
      return r;
    },
    [account, network, updateAccountOverviewState],
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
      updateAccountOverviewState({
        initialized: false,
        isRefreshing: true,
      });
      if (network.isAllNetworks) {
        updateAccountWorth({
          worth: '0',
        });
      }
    }
  }, [
    account?.id,
    network?.id,
    network?.isAllNetworks,
    updateAccountOverviewState,
    updateAccountWorth,
    wallet?.id,
  ]);

  const { md } = useMedia();
  const balanceDialogInstance = useRef<IDialogInstance | null>(null);

  if (overviewState.isRefreshing && !overviewState.initialized)
    return (
      <Stack py="$2.5">
        <Skeleton w="$40" h="$7" my="$2.5" />
      </Stack>
    );

  const balanceString = network?.isAllNetworks
    ? accountWorth.worth ?? '0'
    : overview?.netWorth ?? '0';
  const balanceSizeList: { length: number; size: FontSizeTokens }[] = [
    { length: 25, size: '$headingXl' },
    { length: 13, size: '$heading4xl' },
  ];
  const defaultBalanceSize = '$heading5xl';
  const numberFormatter: INumberFormatProps = {
    formatter: 'value',
    formatterOptions: { currency: settings.currencyInfo.symbol },
  };

  const basicTextElement = (
    <NumberSizeableText
      flexShrink={1}
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
  );

  return (
    <XStack alignItems="center" space="$2.5">
      {vaultSettings?.hasFrozenBalance ? (
        <XStack
          borderRadius="$3"
          px="$1"
          py="$0.5"
          mx="$-1"
          my="$-0.5"
          cursor="default"
          focusable
          hoverStyle={{
            bg: '$bgHover',
          }}
          pressStyle={{
            bg: '$bgActive',
          }}
          focusStyle={{
            outlineColor: '$focusRing',
            outlineWidth: 2,
            outlineOffset: 0,
            outlineStyle: 'solid',
          }}
          onPress={() => {
            if (balanceDialogInstance?.current) {
              return;
            }
            balanceDialogInstance.current = showBalanceDetailsDialog({
              accountId: account?.id ?? '',
              networkId: network?.id ?? '',
              onClose: () => {
                balanceDialogInstance.current = null;
              },
            });
          }}
        >
          {basicTextElement}
          <Icon
            name="InfoCircleOutline"
            size="$4"
            color="$iconSubdued"
            ml="$-1"
          />
        </XStack>
      ) : (
        // <IconButton
        //   title={intl.formatMessage({
        //     id: ETranslations.balance_detail_button_balance,
        //   })}
        //   icon="InfoCircleOutline"
        //   variant="tertiary"
        //   onPress={() => {
        //     if (balanceDialogInstance?.current) {
        //       return;
        //     }
        //     balanceDialogInstance.current = showBalanceDetailsDialog({
        //       accountId: account?.id ?? '',
        //       networkId: network?.id ?? '',
        //       onClose: () => {
        //         balanceDialogInstance.current = null;
        //       },
        //     });
        //   }}
        // />
        basicTextElement
      )}
      <IconButton icon="RefreshCcwOutline" variant="tertiary" />
    </XStack>
  );
}

export { HomeOverviewContainer };
