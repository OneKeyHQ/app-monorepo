import { useCallback, useMemo } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  KeyboardDismissView,
  Modal,
  Text,
  ToastManager,
  Typography,
} from '@onekeyhq/components';
import type { ModalProps } from '@onekeyhq/components/src/Modal';
import type { AddEthereumChainParameter } from '@onekeyhq/shared/src/providerApis/ProviderApiEthereum/ProviderApiEthereum.types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useDappApproveAction from '../../../hooks/useDappApproveAction';
import useDappParams from '../../../hooks/useDappParams';
import { NetworkIcon } from '../components/NetworkIcon';
import { SiteSection } from '../components/SiteSection';

import type { ListItem } from '../SwitchRpc';
import type {
  ManageNetworkModalRoutes,
  ManageNetworkRoutesParams,
} from '../types';
import type { RouteProp } from '@react-navigation/core';

type RouteProps = RouteProp<
  ManageNetworkRoutesParams,
  ManageNetworkModalRoutes.AddNetworkConfirm
>;

export type IViewNetworkModalProps = ModalProps;

const useRouteParams = () => {
  const routeProps = useRoute<RouteProps>();
  const { params } = routeProps;
  if ('query' in params) {
    const query: AddEthereumChainParameter = JSON.parse(params.query);
    const {
      chainName,
      chainId,
      blockExplorerUrls,
      nativeCurrency,
      rpcUrls,
      iconUrls,
    } = query;
    const rpcURL = rpcUrls?.at(0);
    const symbol = nativeCurrency?.symbol;
    const exploreUrl = blockExplorerUrls?.at(0);
    const iconUrl = iconUrls?.at(0);
    return {
      id: chainId,
      chainId,
      name: chainName,
      rpcURL,
      symbol,
      exploreUrl,
      iconUrl,
    };
  }
  return params;
};

function ViewNetworkModal(props: IViewNetworkModalProps) {
  const intl = useIntl();
  const { name, symbol, chainId, rpcURL, exploreUrl, iconUrl } =
    useRouteParams();
  const queryInfo = useDappParams();

  const items: ListItem[] = useMemo(() => {
    const data = [
      {
        label: intl.formatMessage({
          id: 'form__name',
          defaultMessage: 'Name',
        }),
        value: name,
      },
      {
        label: intl.formatMessage({
          id: 'form__chain_id',
          defaultMessage: 'Chain ID',
        }),
        value: String(parseInt(chainId ?? '0')),
      },
      {
        label: intl.formatMessage({
          id: 'form__symbol',
          defaultMessage: 'Symbol',
        }),
        value: symbol,
      },
      {
        label: intl.formatMessage({
          id: 'form__explorer',
          defaultMessage: 'Explorer',
        }),
        value: exploreUrl,
      },
      {
        label: intl.formatMessage({
          id: 'form__url',
          defaultMessage: 'RPC Node',
        }),
        value: rpcURL,
      },
    ];
    return data;
  }, [intl, name, rpcURL, chainId, symbol, exploreUrl]);

  return (
    <Modal
      height="560px"
      footer={null}
      scrollViewProps={{
        children: (
          <KeyboardDismissView>
            <Box>
              <Box
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                mb="8"
                mt="6"
              >
                <NetworkIcon
                  name={symbol}
                  logoURI={iconUrl}
                  size="64px"
                  iconName="PlusCircleSolid"
                />
                <Typography.PageHeading mt="4">{`${intl.formatMessage({
                  id: 'title__add_a_network',
                })}`}</Typography.PageHeading>
                <SiteSection
                  url={queryInfo?.sourceInfo?.origin}
                  mt="2"
                  w="full"
                />
                <Typography.Body1 mt="2">
                  {intl.formatMessage(
                    { id: 'title__add_network_desc' },
                    {
                      0: symbol,
                    },
                  )}
                </Typography.Body1>
              </Box>
              <Box bg="surface-default" borderRadius="12" mt="2" mb="3">
                {items.map((item, index) => (
                  <Box
                    display="flex"
                    flexDirection="row"
                    justifyContent="space-between"
                    p="4"
                    alignItems="center"
                    key={index}
                    borderTopRadius={index === 0 ? '12' : undefined}
                    borderBottomRadius={
                      index === items.length - 1 ? '12' : undefined
                    }
                    borderTopColor="divider"
                    borderTopWidth={index !== 0 ? '1' : undefined}
                  >
                    <Text
                      typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
                      color="text-subdued"
                    >
                      {item.label}
                    </Text>
                    <Text
                      typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
                      maxW="56"
                      textAlign="right"
                    >
                      {item.value}
                    </Text>
                  </Box>
                ))}
              </Box>
            </Box>
          </KeyboardDismissView>
        ),
      }}
      {...props}
    />
  );
}

function AddNetworkConfirmModal() {
  const intl = useIntl();
  const { rpcURL, name, symbol, exploreUrl } = useRouteParams();
  const queryInfo = useDappParams();
  const dappApprove = useDappApproveAction({
    id: queryInfo.sourceInfo?.id ?? '',
  });
  const { serviceNetwork } = backgroundApiProxy;

  const onPrimaryActionPress = useCallback(
    async ({ close }) => {
      if (!rpcURL) {
        return;
      }

      try {
        const { existingNetwork } = await serviceNetwork.preAddNetwork(rpcURL);
        if (existingNetwork) {
          ToastManager.show({
            title: intl.formatMessage(
              {
                id: 'form__rpc_url_invalid_exist',
              },
              { name: existingNetwork.name },
            ),
          });
          return;
        }

        const addedNetwork = await serviceNetwork.addNetwork('evm', {
          name: name ?? '-',
          rpcURL,
          symbol,
          explorerURL: exploreUrl,
        });

        ToastManager.show({
          title: intl.formatMessage({ id: 'msg__network_added' }),
        });
        await dappApprove.resolve({
          close,
          result: addedNetwork,
        });
      } catch (error) {
        console.error(error);
        ToastManager.show({
          title: intl.formatMessage({
            id: 'form__rpc_fetched_failed',
          }),
        });
      }
    },
    [rpcURL, serviceNetwork, name, symbol, exploreUrl, intl, dappApprove],
  );

  return (
    <ViewNetworkModal
      footer
      hideSecondaryAction
      onModalClose={dappApprove.reject}
      primaryActionTranslationId="action__add"
      onPrimaryActionPress={onPrimaryActionPress}
    />
  );
}

export { ViewNetworkModal, AddNetworkConfirmModal };
export const AddNetworkConfirm = AddNetworkConfirmModal;
