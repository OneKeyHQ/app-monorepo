import { useCallback, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Badge,
  Heading,
  Icon,
  Page,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import type { IDBUtxoAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalAssetDetailRoutes,
  IModalAssetDetailsParamList,
} from '@onekeyhq/shared/src/routes/assetDetails';
import { getOnChainHistoryTransferDisplayAddress } from '@onekeyhq/shared/src/utils/historyUtils';
import { getPrivacyChainPublicDisplayAddress } from '@onekeyhq/shared/src/utils/privacyChainDisplayUtils';
import {
  EOnChainHistoryTransferType,
  type IOnChainHistoryTxTransfer,
} from '@onekeyhq/shared/types/history';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAccountData } from '../../../hooks/useAccountData';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

import type { RouteProp } from '@react-navigation/core';

type IUtxoListItem = {
  address: string;
  balance: string;
  isShielded?: boolean;
};

function buildHistoryUtxoListItem({
  transfer,
  endpoint,
}: {
  transfer: IOnChainHistoryTxTransfer;
  endpoint: 'from' | 'to';
}): IUtxoListItem {
  return {
    address: getOnChainHistoryTransferDisplayAddress({ transfer, endpoint }),
    balance: transfer.amount,
    isShielded: transfer.type === EOnChainHistoryTransferType.Shielded,
  };
}

function UTXODetails() {
  const route =
    useRoute<
      RouteProp<
        IModalAssetDetailsParamList,
        EModalAssetDetailRoutes.UTXODetails
      >
    >();
  const intl = useIntl();

  const { inputs, outputs, networkId, accountId, txId } = route.params;
  const { account, network, vaultSettings } = useAccountData({
    accountId,
    networkId,
  });
  const isLocalWalletHistory = !!vaultSettings?.localWallet;
  // Local-wallet rows may carry pool labels in the address slot; those are
  // shown via the shielded marker only when they are public addresses.
  const showUtxoEndpoint = useCallback(
    (utxo: IUtxoListItem) =>
      !isLocalWalletHistory ||
      !!getPrivacyChainPublicDisplayAddress({
        networkId,
        address: utxo.address,
      }),
    [isLocalWalletHistory, networkId],
  );
  const renderUtxoEndpoint = useCallback(
    (utxo: IUtxoListItem) => {
      if (!showUtxoEndpoint(utxo)) {
        return null;
      }
      if (utxo.isShielded) {
        return (
          <XStack
            testID="utxo-shielded-endpoint"
            alignItems="center"
            gap="$1.5"
          >
            <Icon name="ShieldOutline" size="$4" color="$iconSubdued" />
            <SizableText size="$bodyMdMedium" $gtMd={{ size: '$bodySmMedium' }}>
              {utxo.address}
            </SizableText>
          </XStack>
        );
      }
      return (
        <SizableText
          size="$bodyMd"
          $gtMd={{
            size: '$bodySm',
          }}
        >
          {utxo.address}
        </SizableText>
      );
    },
    [showUtxoEndpoint],
  );

  const { result, isLoading } = usePromiseResult(
    async () => {
      if (inputs && outputs) {
        return Promise.resolve({
          inputs: inputs.map(({ address, balance }) => ({ address, balance })),
          outputs: outputs.map(({ address, balance }) => ({
            address,
            balance,
          })),
          memo: undefined,
        });
      }

      const r = await backgroundApiProxy.serviceHistory.fetchHistoryTxDetails({
        accountId,
        networkId,
        txid: txId,
        withUTXOs: true,
      });

      if (r) {
        return {
          inputs:
            r.data.sends?.map((send) =>
              buildHistoryUtxoListItem({ transfer: send, endpoint: 'from' }),
            ) ?? [],
          outputs:
            r.data.receives?.map((receive) =>
              buildHistoryUtxoListItem({
                transfer: receive,
                endpoint: 'to',
              }),
            ) ?? [],
          // Shielded chains (zcash) attach decrypted note memos here.
          memo: r.data.memo,
        };
      }

      return {
        inputs: [],
        outputs: [],
        memo: undefined,
      };
    },
    [inputs, networkId, accountId, outputs, txId],
    {
      watchLoading: true,
    },
  );

  const { result: changeAddressesSet } = usePromiseResult<Set<string>>(
    async () => {
      if (!accountId || !networkId) {
        return new Set<string>();
      }

      const utxoAccount = account as IDBUtxoAccount | undefined;
      const xpubSegwit = utxoAccount?.xpubSegwit ?? utxoAccount?.xpub;

      if (!xpubSegwit) {
        return new Set<string>();
      }

      const btcFreshAddresses =
        await backgroundApiProxy.simpleDb.btcFreshAddress.getBTCFreshAddresses({
          networkId,
          xpubSegwit,
        });

      const changeAddresses = [
        ...(btcFreshAddresses?.change?.used ?? []),
        ...(btcFreshAddresses?.change?.unused ?? []),
      ]
        .map((item) => item.address ?? item.name)
        .filter((item): item is string => Boolean(item));

      return new Set(changeAddresses);
    },
    [account, accountId, networkId],
    {
      initResult: new Set<string>(),
    },
  );

  const changeAddressSet = useMemo(
    () => changeAddressesSet ?? new Set<string>(),
    [changeAddressesSet],
  );

  const renderUTXOList = useCallback(
    (utxos: IUtxoListItem[], options?: { showChangeBadge?: boolean }) => (
      <Stack>
        {utxos.map((utxo, index) => (
          // <XStack key={index} gap="$2">
          //   <SizableText size="$bodyMdMedium" color="$textSubdued">
          //     {`#${padStart(String(index), 2, '0')}`}
          //   </SizableText>

          // </XStack>
          <YStack
            key={index}
            {...(index !== 0 && {
              mt: '$2.5',
            })}
          >
            {renderUtxoEndpoint(utxo)}
            {options?.showChangeBadge && changeAddressSet.has(utxo.address) ? (
              <Badge
                badgeType="success"
                badgeSize="sm"
                mt="$1.5"
                alignSelf="flex-start"
              >
                <Badge.Text>
                  {intl.formatMessage({
                    id: ETranslations.wallet_change_address,
                  })}
                </Badge.Text>
              </Badge>
            ) : null}
            <SizableText
              color="$textSubdued"
              size="$bodyMd"
              $gtMd={{
                size: '$bodySm',
              }}
              mt="$1.5"
            >
              {isLocalWalletHistory && !new BigNumber(utxo.balance).isFinite()
                ? intl.formatMessage({ id: ETranslations.global_not_available })
                : `${utxo.balance} ${network?.symbol ?? ''}`}
            </SizableText>
          </YStack>
        ))}
      </Stack>
    ),
    [
      changeAddressSet,
      intl,
      isLocalWalletHistory,
      network?.symbol,
      renderUtxoEndpoint,
    ],
  );

  const renderUTXODetails = useCallback(() => {
    if (isLoading) {
      return (
        <Stack pt={240} justifyContent="center" alignContent="center">
          <Spinner size="large" />
        </Stack>
      );
    }

    return (
      <Stack
        px="$5"
        $gtMd={{
          flexDirection: 'row',
        }}
      >
        <Stack
          $gtMd={{
            flexGrow: 1,
            flexBasis: 0,
          }}
        >
          <Heading
            mb="$2.5"
            color="$textSuccess"
            size="$headingSm"
            $gtMd={{
              size: '$headingXs',
            }}
          >
            {intl.formatMessage({
              id: ETranslations.global_inputs,
            })}{' '}
            • {result?.inputs.length ?? 0}
          </Heading>
          {renderUTXOList(result?.inputs ?? [])}
        </Stack>
        <Icon
          flexShrink={0}
          name="ChevronDownSmallOutline"
          color="$iconSubdued"
          alignSelf="center"
          my="$2"
          $gtMd={{
            rotate: '-90deg',
            my: '$0',
            mx: '$2.5',
          }}
        />
        <Stack
          $gtMd={{
            flexGrow: 1,
            flexBasis: 0,
          }}
        >
          <Heading
            mb="$2.5"
            color="$textSuccess"
            size="$headingSm"
            $gtMd={{
              size: '$headingXs',
            }}
          >
            {intl.formatMessage({
              id: ETranslations.global_outputs,
            })}{' '}
            • {result?.outputs.length ?? 0}
          </Heading>
          {renderUTXOList(result?.outputs ?? [], {
            showChangeBadge: true,
          })}
        </Stack>
      </Stack>
    );
  }, [intl, isLoading, renderUTXOList, result?.inputs, result?.outputs]);

  // Decrypted shielded-note memo (zcash); only rendered when present.
  const renderMemo = useCallback(() => {
    if (isLoading || !result?.memo) return null;
    return (
      <Stack px="$5" pt="$5">
        <Heading
          mb="$2.5"
          size="$headingSm"
          $gtMd={{
            size: '$headingXs',
          }}
        >
          Memo
        </Heading>
        <SizableText
          size="$bodyMd"
          $gtMd={{
            size: '$bodySm',
          }}
        >
          {result.memo}
        </SizableText>
      </Stack>
    );
  }, [isLoading, result?.memo]);

  return (
    <Page scrollEnabled>
      <Page.Header
        title={`${intl.formatMessage({
          id: ETranslations.global_inputs,
        })} & ${intl.formatMessage({
          id: ETranslations.global_outputs,
        })}`}
      />
      <Page.Body testID="history-details-inputs-and-outputs">
        {renderUTXODetails()}
        {renderMemo()}
      </Page.Body>
    </Page>
  );
}

export default UTXODetails;
