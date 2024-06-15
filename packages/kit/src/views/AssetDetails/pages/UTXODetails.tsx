import { useCallback } from 'react';

import { useRoute } from '@react-navigation/core';
import { padStart } from 'lodash';
import { useIntl } from 'react-intl';

import {
  DescriptionList,
  Divider,
  Page,
  SectionList,
  SizableText,
  Spinner,
  Stack,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
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

  const tableLayout = useMedia().gtMd;

  const { inputs, outputs, networkId, txId } = route.params;

  const { network } = useAccountData({ networkId });

  const { result, isLoading } = usePromiseResult(
    async () => {
      if (inputs && outputs) {
        return Promise.resolve({ inputs, outputs });
      }

      const r = await backgroundApiProxy.serviceHistory.fetchHistoryTxDetails({
        networkId,
        txid: txId,
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
    [inputs, networkId, outputs, txId],
    {
      watchLoading: true,
    },
  );

  const renderUTXOList = useCallback(
    (utxos: { address: string; balance: string }[]) => (
      <DescriptionList px="$5" paddingBottom="$2">
        {utxos.map((utxo, index) => (
          <XStack key={index} space="$2">
            <SizableText size="$bodyMdMedium" color="$textSubdued">
              {`#${padStart(String(index), 2, '0')}`}
            </SizableText>
            <YStack flex={1}>
              <SizableText flex={1} numberOfLines={999} size="$bodyMdMedium">
                {utxo.address}
              </SizableText>
              <SizableText color="$textSubdued" size="$bodyMd">
                {`${utxo.balance} ${network?.symbol ?? ''}`}
              </SizableText>
            </YStack>
          </XStack>
        ))}
      </DescriptionList>
    ),
    [network?.symbol],
  );

  const renderUTXODetails = useCallback(() => {
    if (isLoading) {
      return (
        <Stack pt={240} justifyContent="center" alignContent="center">
          <Spinner size="large" />
        </Stack>
      );
    }

    if (tableLayout)
      return (
        <XStack>
          <YStack flex={1}>
            <SectionList.SectionHeader
              title={intl.formatMessage(
                { id: 'form__inputs_int__uppercase' },
                { 0: inputs?.length ?? 0 },
              )}
            />
            {renderUTXOList(result?.inputs ?? [])}
          </YStack>
          <YStack flex={1}>
            <SectionList.SectionHeader
              title={intl.formatMessage(
                { id: 'form__outputs_int__uppercase' },
                { 0: outputs?.length ?? 0 },
              )}
            />
            {renderUTXOList(result?.outputs ?? [])}
          </YStack>
        </XStack>
      );

    return (
      <>
        <SectionList.SectionHeader
          title={intl.formatMessage(
            { id: 'form__inputs_int__uppercase' },
            { 0: inputs?.length ?? 0 },
          )}
        />
        {renderUTXOList(result?.inputs ?? [])}
        <Divider my="$5" />
        <SectionList.SectionHeader
          title={intl.formatMessage(
            { id: 'form__outputs_int__uppercase' },
            { 0: outputs?.length ?? 0 },
          )}
        />
        {renderUTXOList(result?.outputs ?? [])}
      </>
    );
  }, [
    inputs?.length,
    intl,
    isLoading,
    outputs?.length,
    renderUTXOList,
    result?.inputs,
    result?.outputs,
    tableLayout,
  ]);

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({ id: 'title__inputs_and_outputs' })}
      />
      <Page.Body>{renderUTXODetails()}</Page.Body>
    </Page>
  );
}

export { UTXODetails };
