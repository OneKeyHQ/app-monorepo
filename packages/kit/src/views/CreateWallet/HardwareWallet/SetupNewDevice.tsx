import React, { FC } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Box,
  Center,
  HStack,
  Image,
  Modal,
  Typography,
  VStack,
} from '@onekeyhq/components';
import SetupNewDevicePng from '@onekeyhq/kit/assets/wallet/setup-new-device.png';
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

const SetupNewDeviceModal: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();

  const content = (
    <Center>
      <VStack space={4}>
        <Box
          bgColor="surface-neutral-subdued"
          w="full"
          h="160px"
          borderRadius="12px"
        >
          <Image
            source={SetupNewDevicePng}
            w="full"
            h="full"
            resizeMode="cover"
          />
        </Box>
        <VStack space={2} mt={4}>
          <Typography.DisplayMedium>
            {intl.formatMessage({ id: 'content__select_create_new_wallet' })}
          </Typography.DisplayMedium>
          <Typography.Body2 color="text-subdued">
            {intl.formatMessage({
              id: 'content__select_create_new_wallet_desc',
            })}
          </Typography.Body2>
        </VStack>

        <HStack space={4}>
          <Center borderRadius="full" bg="decorative-surface-one" size="32px">
            <Typography.Body2Strong color="decorative-icon-one">
              1
            </Typography.Body2Strong>
          </Center>
          <VStack flex="1" pt="4px">
            <Typography.Body1Strong>
              {intl.formatMessage({
                id: 'content__write_down_all_recovery_seed',
              })}
            </Typography.Body1Strong>
            <Typography.Body2 color="text-subdued" mt="6px">
              {intl.formatMessage({
                id: 'content__write_down_all_recovery_seed_desc',
              })}
            </Typography.Body2>
          </VStack>
        </HStack>

        <HStack space={4}>
          <Center borderRadius="full" bg="decorative-surface-one" size="32px">
            <Typography.Body2Strong color="decorative-icon-one">
              2
            </Typography.Body2Strong>
          </Center>
          <VStack flex="1" pt="4px">
            <Typography.Body1Strong>
              {intl.formatMessage({ id: 'content__set_a_pin_code' })}
            </Typography.Body1Strong>
            <Typography.Body2 color="text-subdued" mt="6px">
              {intl.formatMessage({ id: 'content__set_a_pin_code_desc' })}
            </Typography.Body2>
          </VStack>
        </HStack>

        <HStack space={4}>
          <Center borderRadius="full" bg="decorative-surface-one" size="32px">
            <Typography.Body2Strong color="decorative-icon-one">
              3
            </Typography.Body2Strong>
          </Center>
          <VStack flex="1" pt="4px">
            <Typography.Body1Strong>
              {intl.formatMessage({ id: 'content__follow_instructions' })}
            </Typography.Body1Strong>
            <Typography.Body2 color="text-subdued" mt="6px">
              {intl.formatMessage({ id: 'content__follow_instructions_desc' })}
            </Typography.Body2>
          </VStack>
        </HStack>
      </VStack>
    </Center>
  );

  return (
    <Modal
      header="Setup New Device"
      height="640px"
      primaryActionTranslationId="action__ok_im_done"
      // TODO: Where do `learn more` redirect to?
      secondaryActionTranslationId="action__learn_more"
      onPrimaryActionPress={() => {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.CreateWallet,
          params: { screen: CreateWalletModalRoutes.DeviceStatusCheckModal },
        });
      }}
      scrollViewProps={{
        children: content,
      }}
    />
  );
};

export default SetupNewDeviceModal;
