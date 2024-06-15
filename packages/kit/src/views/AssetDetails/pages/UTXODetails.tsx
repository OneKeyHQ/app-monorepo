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
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import type {
  EModalAssetDetailRoutes,
  IModalAssetDetailsParamList,
} from '@onekeyhq/shared/src/routes/assetDetails';
import type { IUtxoAddressInfo } from '@onekeyhq/shared/types/tx';

import { useAccountData } from '../../../hooks/useAccountData';

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

  const { inputs, outputs, networkId } = route.params;

  const { network } = useAccountData({ networkId });

  const renderUTXOList = useCallback(
    (utxos: IUtxoAddressInfo[]) => (
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

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({ id: 'title__inputs_and_outputs' })}
      />
      <Page.Body>
        {tableLayout ? (
          <XStack>
            <YStack flex={1}>
              <SectionList.SectionHeader
                title={intl.formatMessage(
                  { id: 'form__inputs_int__uppercase' },
                  { 0: inputs?.length ?? 0 },
                )}
              />
              {renderUTXOList(inputs ?? [])}
            </YStack>
            <YStack flex={1}>
              <SectionList.SectionHeader
                title={intl.formatMessage(
                  { id: 'form__outputs_int__uppercase' },
                  { 0: outputs?.length ?? 0 },
                )}
              />
              {renderUTXOList(outputs ?? [])}
            </YStack>
          </XStack>
        ) : (
          <>
            <SectionList.SectionHeader
              title={intl.formatMessage(
                { id: 'form__inputs_int__uppercase' },
                { 0: inputs?.length ?? 0 },
              )}
            />
            {renderUTXOList(inputs ?? [])}
            <Divider my="$5" />
            <SectionList.SectionHeader
              title={intl.formatMessage(
                { id: 'form__outputs_int__uppercase' },
                { 0: outputs?.length ?? 0 },
              )}
            />
            {renderUTXOList(outputs ?? [])}
          </>
        )}
      </Page.Body>
    </Page>
  );
}

export { UTXODetails };
