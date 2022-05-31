import React, { useCallback, useEffect, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  Icon,
  Image,
  KeyboardDismissView,
  Modal,
  Spinner,
  Typography,
  useToast,
} from '@onekeyhq/components';
import { ModalProps } from '@onekeyhq/components/src/Modal';
import { Network } from '@onekeyhq/engine/src/types/network';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { SwitchEthereumChainParameter } from '../../../background/providers/ProviderApiEthereum';
import { ManageNetworkRoutes, ManageNetworkRoutesParams } from '../types';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type RouteProps = RouteProp<
  ManageNetworkRoutesParams,
  ManageNetworkRoutes.SwitchNetwork
>;

type NavigationProps = NativeStackNavigationProp<
  ManageNetworkRoutesParams,
  ManageNetworkRoutes.SwitchNetwork
>;

export type IViewNetworkModalProps = ModalProps & { network?: Network };

function ViewNetworkModal(props: IViewNetworkModalProps) {
  const intl = useIntl();
  const { network } = props;

  return (
    <Modal
      height="560px"
      footer={null}
      scrollViewProps={{
        children: network ? (
          <KeyboardDismissView>
            <Box>
              <Box
                flexDirection="column"
                alignItems="center"
                justifyContent="center"
                mb="8"
                mt="6"
              >
                {network.logoURI ? (
                  <Image
                    src={network.logoURI}
                    alt="logoURI"
                    size="56px"
                    borderRadius="full"
                    fallbackElement={
                      <Center
                        w="56px"
                        h="56px"
                        rounded="full"
                        bgColor="surface-neutral-default"
                      >
                        <Icon size={32} name="QuestionMarkOutline" />
                      </Center>
                    }
                  />
                ) : (
                  <Center
                    w="56px"
                    h="56px"
                    rounded="full"
                    bgColor="surface-neutral-default"
                  >
                    <Icon size={32} name="QuestionMarkOutline" />
                  </Center>
                )}
                <Typography.PageHeading mt="4">
                  {intl.formatMessage(
                    { id: 'title__switch_to_str' },
                    {
                      0: network.name,
                    },
                  )}
                </Typography.PageHeading>
                <Typography.Body1 mt="2" color="text-subdued">
                  {intl.formatMessage(
                    {
                      id: 'content__allow_this_site_to_switch_your_network_to_str',
                    },
                    {
                      0: network.name,
                    },
                  )}
                </Typography.Body1>
              </Box>
            </Box>
          </KeyboardDismissView>
        ) : (
          <Spinner />
        ),
      }}
      {...props}
    />
  );
}

function SwitchNetworkModal() {
  const toast = useToast();
  const navigation = useNavigation<NavigationProps>();
  const routeProps = useRoute<RouteProps>();
  const [network, setNetwork] = useState<Network>();
  const switchParameter: SwitchEthereumChainParameter = JSON.parse(
    routeProps.params.query,
  );
  const { chainId } = switchParameter;
  const networkId = `evm--${parseInt(chainId)}`;

  useEffect(() => {
    (async () => {
      const evmNetwork = await backgroundApiProxy.engine.getNetwork(networkId);
      setNetwork(evmNetwork);
    })();
  }, [networkId]);

  const onPrimaryActionPress = useCallback(async () => {
    try {
      const { serviceNetwork } = backgroundApiProxy;
      await serviceNetwork.changeActiveNetwork(networkId);
      // TODO: change to i18n
      toast.show({ title: 'Switched' });
    } catch (error) {
      console.error(error);
      // TODO: change to i18n
      toast.show({ title: 'Failed to switch network' });
      return;
    }

    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation, networkId, toast]);

  return (
    <ViewNetworkModal
      footer
      network={network}
      hidePrimaryAction={!network}
      hideSecondaryAction
      primaryActionTranslationId="action__confirm"
      primaryActionProps={{
        onPromise: onPrimaryActionPress,
      }}
    />
  );
}

export { ViewNetworkModal, SwitchNetworkModal };
export const SwitchNetwork = SwitchNetworkModal;
