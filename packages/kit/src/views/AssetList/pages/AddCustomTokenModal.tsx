import { useCallback } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Form, Input, Page, useForm } from '@onekeyhq/components';
import { ControlledNetworkSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalAssetListRoutes,
  IModalAssetListParamList,
} from '@onekeyhq/shared/src/routes';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

import type { RouteProp } from '@react-navigation/core';

type IFormValues = {
  networkId: string;
  contractAddress: string;
  symbol: string;
  decimals: number;
};

function AddCustomTokenModal() {
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<
        IModalAssetListParamList,
        EModalAssetListRoutes.AddCustomTokenModal
      >
    >();
  const { networkId, accountId, token } = route.params;

  const { result } = usePromiseResult(async () => {
    const resp =
      await backgroundApiProxy.serviceNetwork.getPublicKeyExportOrWatchingAccountEnabledNetworks();
    const networkIds = resp.map((o) => o.network.id);
    const customTokenEnabledNetworkIds = resp
      .filter((o) => o.publicKeyExportEnabled)
      .map((t) => t.network.id);
    return {
      networkIds,
      customTokenEnabledNetworks: new Set(customTokenEnabledNetworkIds),
    };
  }, []);

  const form = useForm<IFormValues>({
    values: {
      networkId: networkId ?? getNetworkIdsMap().eth,
      contractAddress: token?.address || '',
      symbol: token?.symbol || '',
      decimals: token?.decimals || 0,
    },
    mode: 'onChange',
    reValidateMode: 'onBlur',
  });

  const onConfirm = useCallback(() => {
    const values = form.getValues();
    console.log('=====> : ', values);
  }, [form]);

  return (
    <Page>
      <Page.Header title="Custom Token" />
      <Page.Body px="$5">
        <Form form={form}>
          <Form.Field
            label={intl.formatMessage({ id: ETranslations.global_network })}
            name="networkId"
          >
            <ControlledNetworkSelectorTrigger
              networkIds={result?.networkIds ?? []}
            />
          </Form.Field>
          <Form.Field label="Contract Address" name="contractAddress">
            <Input />
          </Form.Field>
          <Form.Field label="Symbol" name="symbol">
            <Input />
          </Form.Field>
          <Form.Field label="Decimals" name="decimals">
            <Input />
          </Form.Field>
        </Form>
      </Page.Body>
      <Page.Footer onConfirmText="Add" onConfirm={onConfirm} />
    </Page>
  );
}

export default AddCustomTokenModal;
