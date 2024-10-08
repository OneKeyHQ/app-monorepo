import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Alert, Form, Input, Page, Toast, useForm } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useDappApproveAction from '@onekeyhq/kit/src/hooks/useDappApproveAction';
import useDappQuery from '@onekeyhq/kit/src/hooks/useDappQuery';
import type { IAddEthereumChainParameter } from '@onekeyhq/kit-bg/src/providers/ProviderApiEthereum';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';

function AddCustomNetwork() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { $sourceInfo, networkInfo } = useDappQuery<{
    networkInfo: IAddEthereumChainParameter;
  }>();
  const dappApprove = useDappApproveAction({
    id: $sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });
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

  const [isFetchingChainId, setIsFetchingChainId] = useState(false);
  const getChainId = useCallback(
    async (rpcUrl: string) => {
      try {
        setIsFetchingChainId(true);
        const { chainId } =
          await backgroundApiProxy.serviceCustomRpc.getChainIdByRpcUrl({
            rpcUrl,
          });
        if (chainId) {
          form.setValue('chainId', chainId);
        }
        return chainId;
      } finally {
        setIsFetchingChainId(false);
      }
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
          const chainIdFromRpc = await getChainId(rpcUrl);
          if (chainIdFromRpc) {
            finalChainId = chainIdFromRpc;
          }
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
      await backgroundApiProxy.serviceCustomRpc.upsertCustomNetwork(params);
      const network = await backgroundApiProxy.serviceNetwork.getNetwork({
        networkId: accountUtils.buildCustomEvmNetworkId({
          chainId: finalChainId.toString(),
        }),
      });
      void dappApprove.resolve({ result: network });
      Toast.success({
        title: intl.formatMessage({
          id: ETranslations.custom_network_add_custom_network_successfully_toast_text,
        }),
      });
      navigation.pop();
    } catch (error) {
      console.error(error);
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.custom_network_add_custom_network_failed_toast_text,
        }),
      });
    } finally {
      setIsLoading(false);
    }
  }, [form, dappApprove, intl, navigation, getChainId]);

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.custom_network_add_network_action_text,
        })}
      />
      <Page.Body px="$5" gap="$5">
        <Alert
          icon="ErrorOutline"
          type="warning"
          title={intl.formatMessage({
            id: ETranslations.custom_network_form_alert_text,
          })}
        />
        <Form form={form}>
          <Form.Field
            name="networkName"
            label={intl.formatMessage({
              id: ETranslations.form_network_name_label,
            })}
            rules={{
              required: {
                value: true,
                message: intl.formatMessage({
                  id: ETranslations.address_book_add_address_name_required,
                }),
              },
            }}
          >
            <Input
              size="large"
              $gtMd={{
                size: 'medium',
              }}
            />
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
              validate: async (value: string) => {
                if (!value) return undefined;
                if (!uriUtils.parseUrl(value)) {
                  return intl.formatMessage({
                    id: ETranslations.form_rpc_url_invalid,
                  });
                }
                if (!value.startsWith('http')) {
                  return intl.formatMessage({
                    id: ETranslations.form_rpc_url_prefix_required,
                  });
                }
                await getChainId(value);
                return undefined;
              },
            }}
          >
            <Input
              size="large"
              $gtMd={{
                size: 'medium',
              }}
              {...(isFetchingChainId && { addOns: [{ loading: true }] })}
            />
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
            <Input
              size="large"
              $gtMd={{
                size: 'medium',
              }}
              editable={false}
            />
          </Form.Field>
          <Form.Field
            name="symbol"
            label={intl.formatMessage({
              id: ETranslations.manage_token_custom_token_symbol,
            })}
            rules={{
              required: {
                value: true,
                message: intl.formatMessage({
                  id: ETranslations.address_book_add_address_name_required,
                }),
              },
            }}
          >
            <Input
              size="large"
              $gtMd={{
                size: 'medium',
              }}
            />
          </Form.Field>
          <Form.Field
            name="blockExplorerUrl"
            label={intl.formatMessage({
              id: ETranslations.form_block_explorer_url_label,
            })}
            optional
            rules={{
              validate: (value: string) => {
                if (!value) return undefined;
                if (!uriUtils.parseUrl(value)) {
                  return intl.formatMessage({
                    id: ETranslations.form_rpc_url_invalid,
                  });
                }
                if (!value.startsWith('http')) {
                  return intl.formatMessage({
                    id: ETranslations.form_rpc_url_prefix_required,
                  });
                }
                return undefined;
              },
            }}
          >
            <Input
              size="large"
              $gtMd={{
                size: 'medium',
              }}
            />
          </Form.Field>
        </Form>
      </Page.Body>
      <Page.Footer
        onConfirmText={intl.formatMessage({ id: ETranslations.action_save })}
        onCancelText={intl.formatMessage({ id: ETranslations.global_cancel })}
        confirmButtonProps={{
          loading: isLoading,
        }}
        onConfirm={() => form.handleSubmit(onSubmit)()}
        onCancel={() => dappApprove.reject()}
      />
    </Page>
  );
}

export default AddCustomNetwork;
