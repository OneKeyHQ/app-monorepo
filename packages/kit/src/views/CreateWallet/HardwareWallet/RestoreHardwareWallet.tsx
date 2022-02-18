import React, { FC } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Alert,
  Center,
  Image,
  Modal,
  Typography,
  VStack,
} from '@onekeyhq/components';
import UnboxingPng from '@onekeyhq/kit/assets/wallet/unboxing.png';
import {
  CreateWalletModalRoutes,
  CreateWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/CreateWallet';
import {
  ModalRoutes,
  ModalScreenProps,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/types';

type NavigationProps = ModalScreenProps<CreateWalletRoutesParams>;

/* TODO: use i18n keys when available */
const RestoreHardwareWalletModal: FC = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();

  const content = (
    <Center>
      <VStack space={4}>
        <Center
          w="358px"
          h="160px"
          bgColor="surface-neutral-subdued"
          borderRadius="24px"
        >
          <Image source={UnboxingPng} w="116.66px" h="103.89px" />
        </Center>
        <VStack space={2} mt={4}>
          <Typography.DisplayMedium>
            Check the Box Contents
          </Typography.DisplayMedium>
          <Typography.Body2 color="text-subdued">
            If your OneKey device came with a PIN code or recovery seed, it’s
            not safe to use and you should contact OneKey Support.
          </Typography.Body2>
        </VStack>

        <Alert
          alertType="error"
          title="Only use a recovery seed that your device displayed when it was set up"
          expand={false}
          dismiss={false}
        />
      </VStack>
    </Center>
  );

  return (
    <Modal
      header="Setup New Device"
      height="640px"
      // TODO: Replace i18n keys when available
      primaryActionProps={{ children: 'OK, I’m done!' }}
      secondaryActionProps={{ children: 'Learn more' }}
      onPrimaryActionPress={() => {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.CreateWallet,
          params: {
            screen:
              CreateWalletModalRoutes.RestoreHardwareWalletDescriptionModal,
          },
        });
      }}
      scrollViewProps={{
        children: content,
      }}
    />
  );
};

export default RestoreHardwareWalletModal;
