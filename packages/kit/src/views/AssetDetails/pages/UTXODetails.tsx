import { useCallback, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Badge,
  Heading,
  Icon,
  Page,
  SizableText,
  Spinner,
  Stack,
  YStack,
} from '@onekeyhq/components';
import type { IDBUtxoAccount } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalAssetDetailRoutes,
  IModalAssetDetailsParamList,
} from '@onekeyhq/shared/src/routes/assetDetails';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useAccountData } from '../../../hooks/useAccountData';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

import type { RouteProp } from '@react-navigation/core';

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

  const { account, network } = useAccountData({ accountId, networkId });

  const { result, isLoading } = usePromiseResult(
    async () => {
      if (inputs && outputs) {
        return Promise.resolve({ inputs, outputs });
      }

      const r = await backgroundApiProxy.serviceHistory.fetchHistoryTxDetails({
        accountId,
        networkId,
        txid: txId,
        withUTXOs: true,
      });

      if (r) {
        return {
          inputs: r.data.sends?.map((send) => ({
            address: send.from,
            balance: send.amount,
          })),
          outputs: r.data.receives?.map((receive) => ({
            address: receive.to,
            balance: receive.amount,
          })),
        };
      }

      return {
        inputs: [],
        outputs: [],
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
    (
      utxos: { address: string; balance: string }[],
      options?: { showChangeBadge?: boolean },
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
            <SizableText
              size="$bodyMd"
              $gtMd={{
                size: '$bodySm',
              }}
            >
              {utxo.address}
            </SizableText>
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
              {`${utxo.balance} ${network?.symbol ?? ''}`}
            </SizableText>
          </YStack>
        ))}
      </Stack>
    ),
    [changeAddressSet, intl, network?.symbol],
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
      </Page.Body>
    </Page>
  );
}

export default UTXODetails;
