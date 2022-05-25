import React, { useCallback, useMemo } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Icon,
  Image,
  KeyboardDismissView,
  Modal,
  Typography,
  useToast,
} from '@onekeyhq/components';
import { ModalProps } from '@onekeyhq/components/src/Modal';
import { Text } from '@onekeyhq/components/src/Typography';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AddEthereumChainParameter } from '../../../background/providers/ProviderApiEthereum';
import { ManageNetworkRoutes, ManageNetworkRoutesParams } from '../types';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RouteProps = RouteProp<
  ManageNetworkRoutesParams,
  ManageNetworkRoutes.AddNetworkConfirm
>;

type NavigationProps = NativeStackNavigationProp<
  ManageNetworkRoutesParams,
  ManageNetworkRoutes.AddNetworkConfirm
>;

type ListItem = { label: string; value?: string };

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

const Placeholder = () => (
  <Center w="56px" h="56px" rounded="full" bgColor="surface-neutral-default">
    <Icon size={32} name="QuestionMarkOutline" />
  </Center>
);

function ViewNetworkModal(props: IViewNetworkModalProps) {
  const intl = useIntl();
  const { name, symbol, chainId, rpcURL, exploreUrl, iconUrl } =
    useRouteParams();
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
          id: 'form__url',
          defaultMessage: 'URL',
        }),
        value: rpcURL,
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
                {iconUrl ? (
                  <Image
                    src={iconUrl}
                    alt="logoURI"
                    size="56px"
                    borderRadius="full"
                    fallbackElement={<Placeholder />}
                  />
                ) : (
                  <Placeholder />
                )}
                <Typography.PageHeading mt="4">{`${intl.formatMessage({
                  id: 'title__add_a_network',
                })}`}</Typography.PageHeading>
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
  const toast = useToast();
  const navigation = useNavigation<NavigationProps>();
  const intl = useIntl();
  const { rpcURL, name, symbol, exploreUrl } = useRouteParams();
  const { serviceNetwork } = backgroundApiProxy;

  const onPrimaryActionPress = useCallback(async () => {
    if (!rpcURL) {
      return;
    }

    try {
      const { existingNetwork } = await serviceNetwork.preAddNetwork(rpcURL);
      if (existingNetwork) {
        toast.show({
          title: intl.formatMessage(
            {
              id: 'form__rpc_url_invalid_exist',
            },
            { name: existingNetwork.name },
          ),
        });
        return;
      }

      await serviceNetwork.addNetwork('evm', {
        name: name ?? '-',
        rpcURL,
        symbol,
        explorerURL: exploreUrl,
      });

      toast.show({ title: intl.formatMessage({ id: 'msg__network_added' }) });
    } catch (error) {
      console.error(error);
      toast.show({
        title: intl.formatMessage({
          id: 'form__rpc_fetched_failed',
        }),
      });
      return;
    }

    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [
    rpcURL,
    toast,
    intl,
    navigation,
    serviceNetwork,
    name,
    symbol,
    exploreUrl,
  ]);

  return (
    <ViewNetworkModal
      footer
      hideSecondaryAction
      primaryActionTranslationId="action__confirm"
      primaryActionProps={{
        onPromise: onPrimaryActionPress,
      }}
    />
  );
}

export { ViewNetworkModal, AddNetworkConfirmModal };
export const AddNetworkConfirm = AddNetworkConfirmModal;
