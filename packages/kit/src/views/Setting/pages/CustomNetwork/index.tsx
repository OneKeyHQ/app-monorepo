import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  Form,
  Input,
  Page,
  Stack,
  Toast,
  useForm,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useDappQuery from '@onekeyhq/kit/src/hooks/useDappQuery';
import type { IAddEthereumChainParameter } from '@onekeyhq/kit-bg/src/providers/ProviderApiEthereum';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';

function AddCustomNetwork() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { networkInfo } = useDappQuery<{
    networkInfo: IAddEthereumChainParameter;
  }>();
  const form = useForm<{
    networkName: string;
    rpcUrl: string;
    chainId: number;
    symbol: string;
    blockExplorerUrl: string;
  }>({
    mode: 'onBlur',
    defaultValues: {
      networkName: networkInfo?.chainName ?? '',
      rpcUrl: networkInfo?.rpcUrls?.[0] ?? '',
      chainId: networkInfo?.chainId ? Number(networkInfo?.chainId) : undefined,
      symbol: networkInfo?.nativeCurrency?.symbol ?? '',
      blockExplorerUrl: networkInfo?.blockExplorerUrls?.[0] ?? '',
    },
  });

  const getChainId = useCallback(
    async (rpcUrl: string) => {
      const { chainId } =
        await backgroundApiProxy.serviceCustomRpc.getChainIdByRpcUrl({
          rpcUrl,
        });
      form.setValue('chainId', chainId);
      return chainId;
    },
    [form],
  );

  const [isLoading, setIsLoading] = useState(false);
  const onSubmit = useCallback(async () => {
    try {
      setIsLoading(true);
      const isValid = await form.trigger();
      if (!isValid) {
        return;
      }

      const { networkName, rpcUrl, chainId, symbol, blockExplorerUrl } =
        form.getValues();

      let finalChainId = chainId;
      try {
        if (!finalChainId) {
          finalChainId = await getChainId(rpcUrl);
        }

        if (!finalChainId) {
          Toast.error({ title: 'Fetch chainId failed.' });
          return;
        }
      } catch (error) {
        console.error(error);
        Toast.error({ title: 'Fetch chainId failed.' });
        return;
      }

      const params = {
        networkName,
        rpcUrl,
        chainId: finalChainId,
        symbol,
        blockExplorerUrl,
      };
      console.log('params: ', params);
      await backgroundApiProxy.serviceCustomRpc.upsertCustomNetwork(params);
      Toast.success({ title: 'Add custom network successfully.' });
      navigation.pop();
    } catch (error) {
      console.error(error);
      Toast.error({ title: 'Add custom network failed.' });
    } finally {
      setIsLoading(false);
    }
  }, [form, getChainId, navigation]);

  return (
    <Page>
      <Page.Header title="Custom EVM Network" />
      <Page.Body px="$5">
        <Stack pb="$5">
          <Alert
            type="warning"
            title="Untrusted networks can fake blockchain and track you. Use only trusted ones."
          />
        </Stack>
        <Form form={form}>
          <Form.Field
            name="networkName"
            label="Network name"
            rules={{
              required: {
                value: true,
                message: intl.formatMessage({
                  id: ETranslations.address_book_add_address_name_required,
                }),
              },
            }}
          >
            <Input />
          </Form.Field>
          <Form.Field
            name="rpcUrl"
            label="RPC URL"
            rules={{
              required: {
                value: true,
                message: intl.formatMessage({
                  id: ETranslations.address_book_add_address_name_required,
                }),
              },
              validate: (value: string) => {
                if (!value) return undefined;
                if (!uriUtils.parseUrl(value)) {
                  return 'Invalid RPC URL';
                }
                if (!value.startsWith('http')) {
                  return 'http/https prefix required';
                }
                void getChainId(value);
                return undefined;
              },
            }}
          >
            <Input />
          </Form.Field>
          <Form.Field
            name="chainId"
            label="Chain ID"
            rules={{
              required: {
                value: true,
                message: intl.formatMessage({
                  id: ETranslations.address_book_add_address_name_required,
                }),
              },
            }}
            disabled
          >
            <Input editable={false} />
          </Form.Field>
          <Form.Field
            name="symbol"
            label="Symbol"
            rules={{
              required: {
                value: true,
                message: intl.formatMessage({
                  id: ETranslations.address_book_add_address_name_required,
                }),
              },
            }}
          >
            <Input />
          </Form.Field>
          <Form.Field
            name="blockExplorerUrl"
            label="Block Explorer URL"
            optional
            rules={{
              validate: (value: string) => {
                if (!value) return undefined;
                if (!uriUtils.parseUrl(value)) {
                  return 'Invalid URL';
                }
                if (!value.startsWith('http')) {
                  return 'http/https prefix required';
                }
                void getChainId(value);
                return undefined;
              },
            }}
          >
            <Input />
          </Form.Field>
        </Form>
      </Page.Body>
      <Page.Footer
        onConfirmText="Save"
        onCancelText="Cancel"
        confirmButtonProps={{
          loading: isLoading,
        }}
        onConfirm={() => form.handleSubmit(onSubmit)()}
        onCancel={() => console.log('onCancel')}
      />
    </Page>
  );
}

export default AddCustomNetwork;
