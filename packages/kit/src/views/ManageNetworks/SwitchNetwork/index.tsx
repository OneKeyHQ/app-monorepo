import React, { useCallback, useEffect, useState } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
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
} from '@onekeyhq/components';
import { ModalProps } from '@onekeyhq/components/src/Modal';
import { Network } from '@onekeyhq/engine/src/types/network';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { SwitchEthereumChainParameter } from '../../../background/providers/ProviderApiEthereum';
import useDappApproveAction from '../../../hooks/useDappApproveAction';
import useDappParams from '../../../hooks/useDappParams';
import { ManageNetworkRoutes, ManageNetworkRoutesParams } from '../types';

type RouteProps = RouteProp<
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
                      0: network.shortName,
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
  const routeProps = useRoute<RouteProps>();
  const [network, setNetwork] = useState<Network>();
  const switchParameter: SwitchEthereumChainParameter = JSON.parse(
    routeProps.params.query,
  );
  const { chainId } = switchParameter;
  const networkId = `evm--${parseInt(chainId)}`;
  const queryInfo = useDappParams();
  const dappApprove = useDappApproveAction({
    id: queryInfo.sourceInfo?.id ?? '',
  });

  useEffect(() => {
    (async () => {
      const evmNetwork = await backgroundApiProxy.engine.getNetwork(networkId);
      setNetwork(evmNetwork);
    })();
  }, [networkId]);

  const onPrimaryActionPress = useCallback(
    async ({ close }) => {
      try {
        const { serviceNetwork } = backgroundApiProxy;
        const newNetwork = await serviceNetwork.changeActiveNetwork(networkId);
        // TODO: change to i18n
        // toast.show({ title: 'Switched' });
        await dappApprove.resolve({
          close,
          result: newNetwork,
        });
      } catch (error) {
        console.error(error);
        // TODO: change to i18n
        // toast.show({ title: 'Failed to switch network' });
      }
    },
    [dappApprove, networkId],
  );

  return (
    <ViewNetworkModal
      footer
      network={network}
      hidePrimaryAction={!network}
      hideSecondaryAction
      onModalClose={dappApprove.reject}
      primaryActionTranslationId="action__confirm"
      onPrimaryActionPress={onPrimaryActionPress}
    />
  );
}

export { ViewNetworkModal, SwitchNetworkModal };
export const SwitchNetwork = SwitchNetworkModal;
