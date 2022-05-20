import React, { FC } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Box, Center, Image, Modal, Typography } from '@onekeyhq/components';
import ClassicSetupNewDevicePng from '@onekeyhq/kit/assets/wallet/classic-setup-new-device.png';
import { CreateWalletRoutesParams } from '@onekeyhq/kit/src/routes/Modal/CreateWallet';
import { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

type NavigationProps = ModalScreenProps<CreateWalletRoutesParams>;

const SetupNewDeviceModal: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();

  const numberedList = [
    {
      title: intl.formatMessage({
        id: 'content__write_down_all_recovery_seed',
      }),
      description: intl.formatMessage({
        id: 'content__write_down_all_recovery_seed_desc',
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
          source={ClassicSetupNewDevicePng}
          w="full"
          h="full"
          resizeMode="cover"
        />
      </Box>
      <Box>
        <Typography.DisplayMedium mb={2}>
          {intl.formatMessage({ id: 'content__select_create_new_wallet' })}
        </Typography.DisplayMedium>
        <Typography.Body2 color="text-subdued">
          {intl.formatMessage({
            id: 'content__select_create_new_wallet_desc',
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
      header="Setup New Device"
      height="640px"
      primaryActionTranslationId="action__ok_im_done"
      // TODO: Where do `learn more` redirect to?
      secondaryActionTranslationId="action__learn_more"
      onPrimaryActionPress={() => {
        navigation.popToTop();
      }}
      scrollViewProps={{
        children: content,
      }}
    />
  );
};

export default SetupNewDeviceModal;
