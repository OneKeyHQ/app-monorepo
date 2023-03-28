import type { FC } from 'react';

import { useRoute } from '@react-navigation/core';
import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Box, Center, Image, Modal, Typography } from '@onekeyhq/components';
import ClassicRestoreWalletPng from '@onekeyhq/kit/assets/wallet/restore-classic-device.png';
import type { CreateWalletRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/CreateWallet';
import {
  CreateWalletModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/routesEnum';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import type { RouteProp } from '@react-navigation/core';

type NavigationProps = ModalScreenProps<CreateWalletRoutesParams>;
type RouteProps = RouteProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.RestoreHardwareWalletDescriptionModal
>;

const RestoreHardwareWalletDescriptionModal: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const route = useRoute<RouteProps>();
  const { device } = route?.params || {};

  const numberedList = [
    {
      title: intl.formatMessage({
        id: 'content__enter_your_recovery_seed',
      }),
      description: intl.formatMessage({
        id: 'content__enter_your_recovery_seed_desc',
      }),
    },
    {
      title: intl.formatMessage({ id: 'content__set_a_pin_code' }),
      description: intl.formatMessage({ id: 'content__set_a_pin_code_desc' }),
    },
    {
      title: intl.formatMessage({ id: 'content__follow_instructions' }),
      description: intl.formatMessage({
        id: 'content__follow_instructions_desc',
      }),
    },
  ];

  const content = (
    <>
      <Box
        bgColor="surface-neutral-subdued"
        w="full"
        h="160px"
        borderRadius="12px"
        mb={8}
      >
        <Image
          source={ClassicRestoreWalletPng}
          w="full"
          h="full"
          resizeMode="cover"
        />
      </Box>
      <Box>
        <Typography.DisplayMedium mb={2}>
          {intl.formatMessage({ id: 'content__select_restore_wallet' })}
        </Typography.DisplayMedium>
        <Typography.Body2 color="text-subdued">
          {intl.formatMessage({
            id: 'content__select_restore_wallet_desc',
          })}
        </Typography.Body2>
      </Box>

      {numberedList.map((item, index) => (
        <Box key={index} flexDirection="row" mt={4}>
          <Center rounded="full" bg="decorative-surface-one" size={8} mr={4}>
            <Typography.Body2Strong color="decorative-icon-one">
              {index + 1}
            </Typography.Body2Strong>
          </Center>
          <Box flex={1} pt={1}>
            <Typography.Body1Strong>{item.title}</Typography.Body1Strong>
            <Typography.Body2 color="text-subdued" mt={1.5}>
              {item.description}
            </Typography.Body2>
          </Box>
        </Box>
      ))}
    </>
  );

  return (
    <Modal
      header="Restore Wallet"
      height="640px"
      primaryActionTranslationId="action__ok_im_done"
      secondaryActionTranslationId="action__learn_more"
      onPrimaryActionPress={() => {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.CreateWallet,
          params: {
            screen: CreateWalletModalRoutes.DeviceStatusCheckModal,
            params: { device },
          },
        });
      }}
      scrollViewProps={{
        children: content,
      }}
    />
  );
};

export default RestoreHardwareWalletDescriptionModal;
