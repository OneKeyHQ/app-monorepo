import type { FC } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Account,
  Box,
  Form,
  HStack,
  Modal,
  Typography,
  useForm,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  getActiveWalletAccount,
  useActiveWalletAccount,
} from '@onekeyhq/kit/src/hooks/redux';
import { getDeviceTypeByDeviceId } from '@onekeyhq/kit/src/utils/hardware';
import type { IOneKeyDeviceType } from '@onekeyhq/shared/types';

import FormChainSelector from '../../components/Form/ChainSelector';
import WalletAvatar from '../../components/WalletSelector/WalletAvatar';
import { ModalRoutes, RootRoutes } from '../../routes/routesEnum';
import { SendModalRoutes } from '../Send/types';

import type { ModalScreenProps } from '../../routes/types';
import type { SendRoutesParams } from '../Send/types';
import type { ScanQrcodeRoutes, ScanQrcodeRoutesParams } from './types';
import type { RouteProp } from '@react-navigation/core';

type NavigationProps = ModalScreenProps<SendRoutesParams>;
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
  const navigation = useNavigation<NavigationProps['navigation']>();
  const route = useRoute<PreviewSendRouteProp>();
  const { address, possibleNetworks = [] } = route.params;
  const { bottom } = useSafeAreaInsets();
  const { control, getValues } = useForm<{
    network: string;
  }>({
    defaultValues: { network: possibleNetworks[0] },
  });
  const { account, wallet } = useActiveWalletAccount();

  return (
    <Modal
      onPrimaryActionPress={async () => {
        const { serviceNetwork } = backgroundApiProxy;
        await serviceNetwork.changeActiveNetwork(getValues('network'));
        const { accountId, networkId } = getActiveWalletAccount();
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.Send,
          params: {
            screen: SendModalRoutes.PreSendToken,
            params: {
              accountId,
              networkId,
              from: '',
              to: address,
              amount: '',
            },
          },
        });
      }}
      primaryActionTranslationId="action__next"
      hideSecondaryAction
      header={intl.formatMessage({ id: 'modal__preview' })}
      scrollViewProps={{
        pb: `${bottom}px`,
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
              <>
                <Typography.Body2Strong mb={1}>
                  {intl.formatMessage({ id: 'form__account' })}
                </Typography.Body2Strong>
                <HStack
                  p="15px"
                  borderWidth={1}
                  borderColor="border-disabled"
                  borderRadius="12px"
                  alignItems="center"
                  bg="surface-disabled"
                >
                  <WalletAvatar
                    walletImage={wallet?.type}
                    hwWalletType={
                      (wallet?.deviceType as IOneKeyDeviceType) ||
                      getDeviceTypeByDeviceId(wallet?.associatedDevice)
                    }
                    avatar={wallet?.avatar}
                    size="sm"
                    mr="12px"
                  />
                  <Account
                    color="text-disabled"
                    hiddenAvatar
                    address={account?.address ?? ''}
                    name={account?.name}
                  />
                </HStack>
              </>
            </Form>
          </>
        ),
      }}
    />
  );
};
PreviewSend.displayName = 'PreviewSend';
export default PreviewSend;
