import { useCallback, useEffect, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Alert,
  Dialog,
  Form,
  IconButton,
  Input,
  Page,
  Toast,
  useForm,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import useDappApproveAction from '@onekeyhq/kit/src/hooks/useDappApproveAction';
import useDappQuery from '@onekeyhq/kit/src/hooks/useDappQuery';
import type { IAddEthereumChainParameter } from '@onekeyhq/kit-bg/src/providers/ProviderApiEthereum';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  EChainSelectorPages,
  IChainSelectorParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';

import { useDappCloseHandler } from '../../../DAppConnection/pages/DappOpenModalPage';

import type { RouteProp } from '@react-navigation/core';

const parseChainId = (chainId: string | number): string => {
  if (typeof chainId === 'number') {
    return chainId.toString();
  }
  if (typeof chainId === 'string') {
    if (chainId.startsWith('0x')) {
      return parseInt(chainId, 16).toString();
    }
    return chainId;
  }
  return '';
};

function AddCustomNetwork() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const route =
    useRoute<
      RouteProp<IChainSelectorParamList, EChainSelectorPages.AddCustomNetwork>
    >();
  const {
    state,
    networkId: routeNetworkId,
    onSuccess,
    onDeleteSuccess,
    networkName: routeNetworkName,
    rpcUrl: routeRpcUrl,
    chainId: routeChainId,
    symbol: routeSymbol,
    blockExplorerUrl: routeBlockExplorerUrl,
  } = route.params ?? {};

  const isEditMode = !!(route.params ?? {}).chainId;

  const { $sourceInfo, networkInfo } = useDappQuery<{
    networkInfo: IAddEthereumChainParameter;
  }>();
  const dappApprove = useDappApproveAction({
    id: $sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const getInitialChainId = () => {
    if (routeChainId) {
      return String(routeChainId);
    }
    if (networkInfo?.chainId) {
      return parseChainId(networkInfo.chainId);
    }
    return '';
  };

  const form = useForm<{
    networkName: string;
    rpcUrl: string;
    chainId: string;
    symbol: string;
    blockExplorerUrl: string;
  }>({
    mode: 'onBlur',
    defaultValues: {
      networkName: routeNetworkName ?? networkInfo?.chainName ?? '',
      rpcUrl: routeRpcUrl ?? networkInfo?.rpcUrls?.[0] ?? '',
      chainId: getInitialChainId(),
      symbol: routeSymbol ?? networkInfo?.nativeCurrency?.symbol ?? '',
      blockExplorerUrl:
        routeBlockExplorerUrl ?? networkInfo?.blockExplorerUrls?.[0] ?? '',
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
          form.setValue('chainId', parseChainId(chainId));
        }
        return chainId;
      } catch (error) {
        form.setValue('chainId', '');
        throw error;
      } finally {
        setIsFetchingChainId(false);
      }
    },
    [form],
  );

  const [symbolDescription, setSymbolDescription] = useState('');
  const observedChainId = form.watch('chainId');
  useEffect(() => {
    async function searchChainDataFromServer() {
      const chainId = new BigNumber(observedChainId);
      if (!chainId.isInteger()) {
        return;
      }
      const chainInfo =
        await backgroundApiProxy.serviceCustomRpc.searchCustomNetworkByChainList(
          {
            chainId: chainId.toString(),
          },
        );
      if (!chainInfo) {
        return;
      }
      const currentSymbol = form.getValues('symbol');
      if (
        chainInfo.nativeCurrency?.symbol &&
        chainInfo.nativeCurrency.symbol !== currentSymbol
      ) {
        setSymbolDescription(
          intl.formatMessage(
            {
              id: ETranslations.form_symbol_recommend_text,
            },
            {
              chainID: chainId.toString(),
              symbol: chainInfo.nativeCurrency?.symbol,
            },
          ),
        );
        console.log(
          'chainInfo.nativeCurrency?.symbol: ',
          chainInfo.nativeCurrency?.symbol,
          currentSymbol,
        );
      }
    }
    void searchChainDataFromServer();
  }, [observedChainId, form, intl]);

  const [isLoading, setIsLoading] = useState(false);
  const onSubmit = useCallback(async () => {
    try {
      const isValid = await form.trigger();
      if (!isValid) {
        return;
      }
      setIsLoading(true);

      const { networkName, rpcUrl, chainId, symbol, blockExplorerUrl } =
        form.getValues();

      let finalChainId = parseInt(chainId, 10);
      try {
        if (!finalChainId) {
          const chainIdFromRpc = await getChainId(rpcUrl);
          if (chainIdFromRpc) {
            finalChainId = chainIdFromRpc;
          }
        }

        if (!finalChainId) {
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.form_rpc_url_invalid,
            }),
          });
          return;
        }
      } catch (error) {
        console.error(error);
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.form_rpc_url_invalid,
          }),
        });
        return;
      }

      const networkId = accountUtils.buildCustomEvmNetworkId({
        chainId: finalChainId.toString(),
      });

      const existingNetwork =
        await backgroundApiProxy.serviceNetwork.getNetworkSafe({ networkId });
      if (existingNetwork && !existingNetwork.isCustomNetwork) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.custom_network_network_exists_feedback_text,
          }),
        });
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
        networkId,
      });
      void dappApprove.resolve({ result: network });
      setTimeout(() => {
        onSuccess?.(network);
        defaultLogger.account.wallet.customNetworkAdded({
          chainID: String(finalChainId),
        });
      }, 500);
      Toast.success({
        title: intl.formatMessage({
          id: isEditMode
            ? ETranslations.feedback_change_saved
            : ETranslations.custom_network_add_custom_network_successfully_toast_text,
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
  }, [form, dappApprove, intl, navigation, getChainId, onSuccess, isEditMode]);

  const onDelete = useCallback(async () => {
    if (!routeNetworkId) {
      return;
    }
    Dialog.show({
      title: intl.formatMessage({
        id: ETranslations.custom_network_remove_network_dialog_title,
      }),
      description: intl.formatMessage({
        id: ETranslations.custom_network_remove_network_dialog_description,
      }),
      showCancelButton: true,
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_remove,
      }),
      confirmButtonProps: {
        variant: 'destructive',
      },
      onConfirm: async ({ close }) => {
        await backgroundApiProxy.serviceCustomRpc.deleteCustomNetwork({
          networkId: routeNetworkId,
        });
        Toast.success({
          title: intl.formatMessage({
            id: ETranslations.explore_removed_success,
          }),
        });
        navigation.pop();
        onDeleteSuccess?.();
        await close();
      },
    });
  }, [routeNetworkId, intl, navigation, onDeleteSuccess]);

  const headerRight = useCallback(() => {
    if (state !== 'edit') {
      return null;
    }
    return (
      <IconButton
        title={intl.formatMessage({ id: ETranslations.global_remove })}
        icon="DeleteOutline"
        variant="tertiary"
        iconColor="$iconSubdued"
        onPress={() => onDelete()}
      />
    );
  }, [state, intl, onDelete]);

  const handleOnClose = useDappCloseHandler(dappApprove);

  return (
    <Page scrollEnabled onClose={handleOnClose}>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.custom_network_add_network_action_text,
        })}
        headerRight={headerRight}
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
                try {
                  const chainId = await getChainId(value);
                  if (!chainId) {
                    return intl.formatMessage({
                      id: ETranslations.form_rpc_url_invalid,
                    });
                  }
                } catch (error) {
                  return intl.formatMessage({
                    id: ETranslations.form_rpc_url_invalid,
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
              {...(isFetchingChainId && { addOns: [{ loading: true }] })}
            />
          </Form.Field>
          <Form.Field name="chainId" label="Chain ID" disabled>
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
            description={symbolDescription}
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
