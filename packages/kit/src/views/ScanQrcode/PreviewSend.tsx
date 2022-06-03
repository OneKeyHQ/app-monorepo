/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { FC, useMemo } from 'react';

import {
  NavigationProp,
  RouteProp,
  useIsFocused,
  useNavigation,
  useRoute,
} from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Account,
  Box,
  Form,
  FormControl,
  HStack,
  Icon,
  Modal,
  Select,
  Token,
  Typography,
  useForm,
  useSafeAreaInsets,
  useUserDevice,
} from '@onekeyhq/components';
import { Network } from '@onekeyhq/engine/src/types/network';
import { useActiveWalletAccount } from '@onekeyhq/kit/src/hooks/redux';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import FormChainSelector from '../../components/Form/ChainSelector';
import AccountSelector from '../../components/Header/AccountSelector';
import ChainSelector from '../../components/Header/ChainSelector';
import WalletAvatar from '../../components/Header/WalletAvatar';
import { useManageNetworks } from '../../hooks';
import {
  ModalRoutes,
  ModalRoutesParams,
  RootRoutes,
  RootRoutesParams,
} from '../../routes/types';
import { getDeviceTypeByDeviceId } from '../../utils/device/ble/OnekeyHardware';
import { ScanQrcodeRoutes, ScanQrcodeRoutesParams } from './types';
import { SendRoutes, SendRoutesParams } from '../Send/types';

type NavigationProps = NavigationProp<SendRoutesParams, SendRoutes.Send>;
type PreviewSendProps = {
  address: string;
  possibleNetworks?: string[];
};
type PreviewSendRouteProp = RouteProp<
  ScanQrcodeRoutesParams,
  ScanQrcodeRoutes.PreviewSend
>;
const PreviewSend: FC<PreviewSendProps> = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<PreviewSendRouteProp>();
  const { address, possibleNetworks = [] } = route.params;
  const { bottom } = useSafeAreaInsets();
  const { control, handleSubmit, getValues, setValue, watch } = useForm<{
    network: string;
  }>({
    defaultValues: { network: possibleNetworks[0] },
  });
  const { account, wallet } = useActiveWalletAccount();

  const { enabledNetworks = [] } = useManageNetworks();
  // const { screenWidth } = useUserDevice();

  const options =
    possibleNetworks.filter((network) =>
      enabledNetworks.find((n) => n.shortName === network),
    ) || [];
  // .map((network) => ({
  //   label: network.shortName,
  //   value: network.id,
  //   tokenProps: {
  //     src: network.logoURI,
  //     letter: network.shortName,
  //   },
  //   badge: network.impl === 'evm' ? 'EVM' : undefined,
  // }));

  return (
    <Modal
      // hidePrimaryAction
      primaryActionProps={{
        type: 'primary',
        onPress: () => {
          navigation.navigate(SendRoutes.Send, {});
        },
      }}
      primaryActionTranslationId="action__import"
      hideSecondaryAction
      header={intl.formatMessage({ id: 'modal__preview' })}
      footer={null}
      scrollViewProps={{
        pb: bottom,
        children: (
          <>
            <Box
              borderColor="border-subdued"
              borderWidth="1px"
              borderRadius="12px"
              borderStyle="dashed"
              alignItems="center"
              justifyContent="center"
              // flexWrap="nowrap"
              p="20px"
              mb="32px"
            >
              <Typography.Body2 textAlign="center" wordBreak="break-all">
                {address}
              </Typography.Body2>
            </Box>
            <Form>
              <FormChainSelector
                hideHelpText
                selectableNetworks={possibleNetworks}
                control={control}
                name="network"
              />
              <FormControl.Label mb={0}>
                <Typography.Body2Strong>
                  {intl.formatMessage({ id: 'form__account' })}
                </Typography.Body2Strong>
              </FormControl.Label>
              <HStack
                p="7px"
                borderWidth={1}
                borderColor="transparent"
                borderStyle="dashed"
                bg="transparent"
                space={4}
                borderRadius="xl"
                alignItems="center"
              >
                <WalletAvatar
                  walletImage={wallet?.type}
                  hwWalletType={getDeviceTypeByDeviceId(
                    wallet?.associatedDevice,
                  )}
                  avatar={wallet?.avatar}
                  size="sm"
                  mr={3}
                />
                <Box flex={1}>
                  <Account
                    hiddenAvatar
                    address={account?.address ?? ''}
                    name={account?.name}
                  />
                </Box>
              </HStack>
            </Form>
          </>
        ),
      }}
    />
  );
};
PreviewSend.displayName = 'PreviewSend';
export default PreviewSend;
