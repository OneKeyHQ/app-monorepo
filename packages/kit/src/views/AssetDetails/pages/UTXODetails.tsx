import { useCallback } from 'react';

import { useRoute } from '@react-navigation/core';
import { padStart } from 'lodash';
import { useIntl } from 'react-intl';

import {
  DescriptionList,
  Divider,
  Page,
  SectionList,
  XStack,
} from '@onekeyhq/components';
import type { IBtcUTXO } from '@onekeyhq/kit-bg/src/vaults/impls/btc/types';

import type {
  EModalAssetDetailRoutes,
  IModalAssetDetailsParamList,
} from '../router/types';
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

  const { inputs, outputs } = route.params;

  const renderUTXOList = useCallback(
    (utxos: Partial<IBtcUTXO>[]) => (
      <DescriptionList px="$5" paddingBottom="$2">
        {utxos.map((utxo, index) => (
          <DescriptionList.Item key={index}>
            <DescriptionList.Item.Key>{`#${padStart(
              String(index),
              2,
              '0',
            )}`}</DescriptionList.Item.Key>
            <XStack alignItems="center">
              <DescriptionList.Item.Value>
                {utxo.address}
              </DescriptionList.Item.Value>
            </XStack>
          </DescriptionList.Item>
        ))}
      </DescriptionList>
    ),
    [],
  );

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({ id: 'title__inputs_and_outputs' })}
      />
      <Page.Body>
        <SectionList.SectionHeader
          title={intl.formatMessage(
            { id: 'form__inputs_int__uppercase' },
            { 0: inputs.length },
          )}
        />
        {renderUTXOList(inputs)}
        <Divider my="$5" />
        <SectionList.SectionHeader
          title={intl.formatMessage(
            { id: 'form__outputs_int__uppercase' },
            { 0: outputs.length },
          )}
        />
        {renderUTXOList(outputs)}
      </Page.Body>
    </Page>
  );
}

export { UTXODetails };
