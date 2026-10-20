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
import { ZcashMemo } from '@onekeyhq/kit/src/components/ZcashMemo';
import type { IDBUtxoAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalAssetDetailRoutes,
  IModalAssetDetailsParamList,
} from '@onekeyhq/shared/src/routes/assetDetails';
import { getOnChainHistoryTransferDisplayAddress } from '@onekeyhq/shared/src/utils/historyUtils';
import {
  getPrivacyChainEntryItem,
  getPrivacyChainPublicDisplayAddress,
} from '@onekeyhq/shared/src/utils/privacyChainDisplayUtils';
import {
  EOnChainHistoryTransferType,
  type IOnChainHistoryTxTransfer,
} from '@onekeyhq/shared/types/history';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAccountData } from '../../../hooks/useAccountData';
import { useLocalWalletAccountAddresses } from '../../../hooks/useLocalWalletAccountAddresses';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import {
  resolvePrivacyChainEndpointDisplay,
  toPrivacyChainLocalWalletDisplay,
} from '../../../utils/privacyChainEndpointLabel';

import type { RouteProp } from '@react-navigation/core';

type IUtxoListItem = {
  address: string;
  balance: string;
  isShielded?: boolean;
  isChange?: boolean;
  isOwn?: boolean;
  label?: string;
  poolId?: number;
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
    isChange: transfer.isChange,
    isOwn: transfer.isOwn,
    label: transfer.label,
    poolId: transfer.poolId,
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

  const { inputs, outputs, networkId, accountId, txId, privacyChainPoolId } =
    route.params;
  const { account, network, vaultSettings } = useAccountData({
    accountId,
    networkId,
  });
  const isLocalWalletHistory = !!vaultSettings?.localWallet;
  const localWalletAddresses = useLocalWalletAccountAddresses({
    accountId,
    networkId,
    enabled: isLocalWalletHistory,
  });
  const localWalletDisplay = useMemo(
    () =>
      vaultSettings?.localWallet
        ? toPrivacyChainLocalWalletDisplay(vaultSettings.localWallet)
        : undefined,
    [vaultSettings?.localWallet],
  );
  // Public endpoints and shielded entries have separate display rules. An own
  // address shows only when it is exactly one the account displays; a
  // shielded entry otherwise shows a known counterparty address or its pool.
  const showUtxoEndpoint = useCallback(
    (utxo: IUtxoListItem) =>
      !isLocalWalletHistory ||
      !!getPrivacyChainPublicDisplayAddress({
        publicAddressPattern: vaultSettings?.localWallet?.publicAddressPattern,
        address: utxo.address,
      }),
    [isLocalWalletHistory, vaultSettings?.localWallet?.publicAddressPattern],
  );
  const renderUtxoEndpoint = useCallback(
    (
      utxo: IUtxoListItem,
      {
        isInput,
        ownAddresses,
      }: { isInput: boolean; ownAddresses: Set<string> },
    ) => {
      if (utxo.isShielded) {
        const display = resolvePrivacyChainEndpointDisplay({
          intl,
          localWallet: localWalletDisplay,
          addresses: localWalletAddresses,
          item: getPrivacyChainEntryItem({
            pools: localWalletDisplay?.pools,
            entry: utxo,
            isInput,
            ownAddresses,
          }),
        });
        return (
          <XStack
            testID="utxo-shielded-endpoint"
            alignItems="center"
            gap="$1.5"
          >
            <Icon
              name="ShieldOutline"
              size="$4"
              color="$iconSubdued"
              flexShrink={0}
            />
            <SizableText
              size="$bodyMdMedium"
              flexShrink={1}
              $gtMd={{ size: '$bodySmMedium' }}
              $platform-web={{ wordBreak: 'break-all' }}
            >
              {display.address ?? display.poolLabel}
            </SizableText>
          </XStack>
        );
      }
      if (!showUtxoEndpoint(utxo)) return null;
      let content = utxo.address;
      if (
        isLocalWalletHistory &&
        (utxo.isOwn || ownAddresses.has(utxo.address))
      ) {
        const display = resolvePrivacyChainEndpointDisplay({
          intl,
          localWallet: localWalletDisplay,
          addresses: localWalletAddresses,
          item: {
            kind: 'own',
            poolId: localWalletDisplay?.pools?.find(
              (pool) => pool.kind === 'public',
            )?.id,
            address: utxo.address,
          },
        });
        content = display.address ?? display.poolLabel;
      }
      return (
        <SizableText
          size="$bodyMd"
          $gtMd={{
            size: '$bodySm',
          }}
        >
          {content}
        </SizableText>
      );
    },
    [
      intl,
      isLocalWalletHistory,
      localWalletAddresses,
      localWalletDisplay,
      showUtxoEndpoint,
    ],
  );

  const { result, isLoading } = usePromiseResult(
    async () => {
      if (!isLocalWalletHistory && inputs && outputs) {
        return Promise.resolve({
          inputs: inputs.map(({ address, balance }) => ({ address, balance })),
          outputs: outputs.map(({ address, balance }) => ({
            address,
            balance,
          })),
          memo: undefined,
          binaryMemos: undefined,
          inputOutputSource: undefined,
        });
      }

      const r = await backgroundApiProxy.serviceHistory.fetchHistoryTxDetails({
        accountId,
        networkId,
        txid: txId,
        privacyChainPoolId,
        withUTXOs: true,
      });

      if (!isLocalWalletHistory) {
        return {
          inputs:
            r?.data.sends?.map((send) => ({
              address: send.from,
              balance: send.amount,
            })) ?? [],
          outputs:
            r?.data.receives?.map((receive) => ({
              address: receive.to,
              balance: receive.amount,
            })) ?? [],
          memo: undefined,
          binaryMemos: undefined,
          inputOutputSource: undefined,
        };
      }

      if (!r) return undefined;
      return {
        inputs:
          r.data.sends?.map((send) =>
            buildHistoryUtxoListItem({ transfer: send, endpoint: 'from' }),
          ) ?? [],
        outputs:
          r.data.receives?.map((receive) =>
            buildHistoryUtxoListItem({ transfer: receive, endpoint: 'to' }),
          ) ?? [],
        // Shielded chains (zcash) attach decrypted note memos here.
        memo: r.data.memo,
        binaryMemos: r.data.binaryMemos,
        inputOutputSource: r.data.inputOutputSource,
      };
    },
    [
      inputs,
      networkId,
      accountId,
      outputs,
      txId,
      privacyChainPoolId,
      isLocalWalletHistory,
    ],
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

  // Addresses the data says are this account's; they pass the
  // displayed-address check before being shown.
  const ownAddresses = useMemo(() => {
    const own = new Set<string>();
    if (!isLocalWalletHistory) return own;
    if (account?.address) own.add(account.address);
    [...(result?.inputs ?? []), ...(result?.outputs ?? [])].forEach(
      (utxo: IUtxoListItem) => {
        if (utxo.isOwn && utxo.address) own.add(utxo.address);
      },
    );
    return own;
  }, [account?.address, isLocalWalletHistory, result]);

  const renderUTXOList = useCallback(
    (
      utxos: IUtxoListItem[],
      options: { showChangeBadge?: boolean; isInput: boolean },
    ) => (
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
            {renderUtxoEndpoint(utxo, {
              isInput: options.isInput,
              ownAddresses,
            })}
            {options.showChangeBadge &&
            (utxo.isChange || changeAddressSet.has(utxo.address)) ? (
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
      ownAddresses,
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

    if (!result) {
      return (
        <SizableText px="$5">
          {intl.formatMessage({ id: ETranslations.global_not_available })}
        </SizableText>
      );
    }
    return (
      <YStack gap="$4">
        {result.inputOutputSource ? (
          <SizableText px="$5" color="$textSubdued" size="$bodySm">
            {intl.formatMessage({
              id:
                result.inputOutputSource === 'account'
                  ? ETranslations.privacy_history_wallet_io__desc
                  : ETranslations.privacy_history_public_io__desc,
            })}
          </SizableText>
        ) : null}
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
              {intl.formatMessage({ id: ETranslations.global_inputs })} •{' '}
              {result?.inputs.length ?? 0}
            </Heading>
            {renderUTXOList(result?.inputs ?? [], { isInput: true })}
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
              {intl.formatMessage({ id: ETranslations.global_outputs })} •{' '}
              {result?.outputs.length ?? 0}
            </Heading>
            {renderUTXOList(result?.outputs ?? [], {
              isInput: false,
              showChangeBadge: true,
            })}
          </Stack>
        </Stack>
      </YStack>
    );
  }, [intl, isLoading, renderUTXOList, result]);

  // Decrypted shielded-note memo (zcash); only rendered when present.
  const renderMemo = useCallback(() => {
    if (isLoading || (!result?.memo && !result?.binaryMemos?.length)) {
      return null;
    }
    return (
      <Stack px="$5" pt="$5">
        <ZcashMemo text={result.memo} binaryMemos={result.binaryMemos} />
      </Stack>
    );
  }, [isLoading, result?.memo, result?.binaryMemos]);

  return (
    <Page scrollEnabled>
      <Page.Header
        title={`${intl.formatMessage({ id: ETranslations.global_inputs })} & ${intl.formatMessage({ id: ETranslations.global_outputs })}`}
      />
      <Page.Body testID="history-details-inputs-and-outputs">
        {renderUTXODetails()}
        {renderMemo()}
      </Page.Body>
    </Page>
  );
}

export default UTXODetails;
