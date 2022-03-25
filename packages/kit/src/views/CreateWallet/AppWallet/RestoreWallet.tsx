import React, { FC } from 'react';

import { useNavigation } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Badge,
  Center,
  HStack,
  Icon,
  Modal,
  Typography,
  VStack,
} from '@onekeyhq/components';
import PressableItem from '@onekeyhq/components/src/Pressable/PressableItem';
import {
  CreateWalletModalRoutes,
  CreateWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/CreateWallet';
import { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import { isNative } from '@onekeyhq/shared/src/platformEnv';

type NavigationProps = ModalScreenProps<CreateWalletRoutesParams>;

const RestoreWalletModal: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation<NavigationProps['navigation']>();

  const startRestoreModal = (inputPwd: string, callBack: () => void) => {
    navigation.navigate(CreateWalletModalRoutes.OnekeyLiteRestoreModal, {
      pwd: inputPwd,
      onRetry: () => {
        callBack?.();
      },
    });
  };

  const startRestorePinVerifyModal = () => {
    navigation.navigate(CreateWalletModalRoutes.OnekeyLitePinCodeVerifyModal, {
      callBack: (inputPwd) => {
        startRestoreModal(inputPwd, () => {
          console.log('restartRestorePinVerifyModal');
          startRestorePinVerifyModal();
        });
        return true;
      },
    });
  };

  const content = (
    <Center>
      <VStack space={4} w="full">
        {/* Restore from iCloud */}
        <PressableItem
          p={4}
          bg="surface-default"
          _hover={undefined}
          borderRadius="12px"
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
          onPress={() => {}}
        >
          <HStack space={3} alignItems="center" flex="1">
            <Icon name="CloudOutline" />
            <Typography.Body1 flex="1">
              {intl.formatMessage({
                id: 'action__restore_from_icloud',
              })}
            </Typography.Body1>
          </HStack>

          <Badge
            title={intl.formatMessage({ id: 'badge__coming_soon' })}
            size="sm"
            type="default"
          />
          {/* <Icon name="ChevronRightOutline" /> */}
        </PressableItem>
        {isNative() ? (
          <PressableItem
            p={4}
            bg="surface-default"
            borderRadius="12px"
            flexDirection="row"
            alignItems="center"
            justifyContent="space-between"
            onPress={() => {
              startRestorePinVerifyModal();
            }}
          >
            <HStack space={3} alignItems="center" flex="1">
              <Icon name="OnekeyLiteOutline" />
              <Typography.Body1 flex="1">
                {intl.formatMessage({
                  id: 'action__restore_with_onekey_lite',
                })}
              </Typography.Body1>
            </HStack>
            <Icon name="ChevronRightOutline" />
          </PressableItem>
        ) : null}
        {/* Restore with Recovery Seed */}
        <PressableItem
          p={4}
          bg="surface-default"
          borderRadius="12px"
          flexDirection="row"
          alignItems="center"
          justifyContent="space-between"
          onPress={() => {
            navigation.navigate(
              CreateWalletModalRoutes.RestoreFromMnemonicModal,
            );
          }}
        >
          <HStack space={3} alignItems="center" flex="1">
            <Icon name="DocumentTextOutline" />
            <Typography.Body1 flex="1">
              {intl.formatMessage({
                id: 'action__restore_with_recovery_seed',
              })}
            </Typography.Body1>
          </HStack>
          <Icon name="ChevronRightOutline" />
        </PressableItem>
      </VStack>
    </Center>
  );

  return (
    <Modal
      footer={null}
      header={intl.formatMessage({ id: 'wallet__app_wallet' })}
      scrollViewProps={{
        children: content,
      }}
    />
  );
};

export default RestoreWalletModal;
