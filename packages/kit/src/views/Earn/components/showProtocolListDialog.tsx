import { useCallback, useEffect, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Dialog,
  ListView,
  NumberSizeableText,
  SizableText,
  Skeleton,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type { IEarnAvailableAssetProtocol } from '@onekeyhq/shared/types/earn';
import type { IStakeProtocolListItem } from '@onekeyhq/shared/types/staking';

import { capitalizeString } from '../../Staking/utils/utils';

function ProtocolListDialogContent({
  symbol,
  accountId,
  indexedAccountId,
  protocols,
  onProtocolSelect,
}: {
  symbol: string;
  accountId: string;
  indexedAccountId?: string;
  protocols: IEarnAvailableAssetProtocol[];
  onProtocolSelect: (protocol: IStakeProtocolListItem) => Promise<void>;
}) {
  const intl = useIntl();
  const [settings] = useSettingsPersistAtom();
  const [protocolData, setProtocolData] = useState<IStakeProtocolListItem[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProtocolData = async () => {
      try {
        console.log('Fetching protocol data for:', {
          symbol,
          accountId,
          protocols,
        });
        setIsLoading(true);

        const data = await backgroundApiProxy.serviceStaking.getProtocolList({
          symbol,
          accountId,
          indexedAccountId,
          networkId: protocols[0]?.networkId,
        });

        console.log('Received protocol data:', data);

        // Filter results to match our protocols
        const filteredData = data.filter((protocol) =>
          protocols.some(
            (p) =>
              p.provider === protocol.provider.name &&
              p.networkId === protocol.network.networkId,
          ),
        );

        console.log('Filtered protocol data:', filteredData);
        setProtocolData(filteredData);
      } catch (error) {
        console.error('Failed to fetch protocol data:', error);
        setProtocolData([]);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchProtocolData();
  }, [symbol, accountId, indexedAccountId, protocols]);

  const handleProtocolPress = useCallback(
    async (protocol: IStakeProtocolListItem) => {
      await onProtocolSelect(protocol);
    },
    [onProtocolSelect],
  );

  if (isLoading) {
    return (
      <YStack gap="$2" py="$4">
        {Array.from({ length: 3 }).map((_, index) => (
          <ListItem key={index}>
            <Skeleton w="$10" h="$10" borderRadius="$2" />
            <YStack flex={1} gap="$2">
              <Skeleton h="$4" w={120} borderRadius="$2" />
              <Skeleton h="$3" w={80} borderRadius="$2" />
            </YStack>
          </ListItem>
        ))}
      </YStack>
    );
  }

  if (protocolData.length === 0) {
    return (
      <YStack py="$4" alignItems="center">
        <SizableText>No protocols available</SizableText>
      </YStack>
    );
  }

  return (
    <YStack gap="$2" maxHeight="$80">
      <ListView
        estimatedItemSize={60}
        data={protocolData}
        renderItem={({ item }) => (
          <ListItem
            userSelect="none"
            onPress={() => handleProtocolPress(item)}
            borderRadius="$2"
            borderCurve="continuous"
            pressStyle={{ backgroundColor: '$bgHover' }}
          >
            <Token
              size="lg"
              borderRadius="$2"
              tokenImageUri={item.provider.logoURI}
              networkImageUri={item.network.logoURI}
            />
            <ListItem.Text
              flex={1}
              primary={capitalizeString(item.provider.name)}
              secondary={
                <NumberSizeableText
                  color="$textSubdued"
                  size="$bodyMd"
                  formatterOptions={{ currency: settings.currencyInfo.symbol }}
                  formatter="marketCap"
                >
                  {item.provider.totalFiatValue || '0'}
                </NumberSizeableText>
              }
            />
            <ListItem.Text
              align="right"
              primary={
                item.provider.aprWithoutFee &&
                Number(item.provider.aprWithoutFee) > 0
                  ? `${BigNumber(item.provider.aprWithoutFee).toFixed(2)}% ${
                      item.provider.rewardUnit || 'APY'
                    }`
                  : null
              }
              secondary={
                item.provider.isStaking
                  ? intl.formatMessage({
                      id: ETranslations.earn_currently_staking,
                    })
                  : undefined
              }
              secondaryTextProps={{
                color: '$textInfo',
                size: '$bodyMd',
              }}
            />
          </ListItem>
        )}
      />
    </YStack>
  );
}

export function showProtocolListDialog({
  symbol,
  accountId,
  indexedAccountId,
  protocols,
  onProtocolSelect,
}: {
  symbol: string;
  accountId: string;
  indexedAccountId?: string;
  protocols: IEarnAvailableAssetProtocol[];
  onProtocolSelect: (params: {
    networkId: string;
    accountId: string;
    indexedAccountId?: string;
    symbol: string;
    provider: string;
    vault?: string;
  }) => Promise<void>;
}) {
  console.log('showProtocolListDialog called with:', { symbol, protocols });
  const handleProtocolSelect = async (protocol: IStakeProtocolListItem) => {
    try {
      defaultLogger.staking.page.selectProvider({
        network: protocol.network.networkId,
        stakeProvider: protocol.provider.name,
      });

      const earnAccount =
        await backgroundApiProxy.serviceStaking.getEarnAccount({
          accountId,
          indexedAccountId,
          networkId: protocol.network.networkId,
        });

      await onProtocolSelect({
        networkId: protocol.network.networkId,
        accountId: earnAccount?.accountId || accountId,
        indexedAccountId:
          earnAccount?.account.indexedAccountId || indexedAccountId,
        symbol,
        provider: protocol.provider.name,
        vault: earnUtils.isMorphoProvider({
          providerName: protocol.provider.name,
        })
          ? protocol.provider.vault
          : undefined,
      });
    } catch (error) {
      console.error('Failed to select protocol:', error);
    }
  };

  return Dialog.show({
    title: appLocale.intl.formatMessage(
      {
        id: ETranslations.earn_symbol_staking_provider,
      },
      { symbol },
    ),
    showFooter: false,
    contentContainerProps: {
      px: '$0',
      pb: '$5',
    },
    renderContent: (
      <ProtocolListDialogContent
        symbol={symbol}
        accountId={accountId}
        indexedAccountId={indexedAccountId}
        protocols={protocols}
        onProtocolSelect={handleProtocolSelect}
      />
    ),
  });
}
