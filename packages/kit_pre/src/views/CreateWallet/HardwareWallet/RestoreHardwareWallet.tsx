import type { FC } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
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
import { useHelpLink } from '@onekeyhq/kit/src/hooks';
import type { CreateWalletRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/CreateWallet';
import {
  CreateWalletModalRoutes,
  ModalRoutes,
  RootRoutes,
} from '@onekeyhq/kit/src/routes/routesEnum';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import { openUrl } from '@onekeyhq/kit/src/utils/openUrl';

import type { RouteProp } from '@react-navigation/core';

type NavigationProps = ModalScreenProps<CreateWalletRoutesParams>;
type RouteProps = RouteProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.RestoreHardwareWalletModal
>;

const RestoreHardwareWalletModal: FC = () => {
  const intl = useIntl();

  const helpCenter = useHelpLink({ path: '' });

  const navigation = useNavigation<NavigationProps['navigation']>();
  const route = useRoute<RouteProps>();
  const { device } = route?.params || {};

  const content = (
    <Center>
      <VStack space={8}>
        <Center h="160px" bgColor="surface-neutral-subdued" borderRadius="24px">
          <Image source={UnboxingPng} w="116.66px" h="103.89px" />
        </Center>
        <VStack space={2}>
          <Typography.DisplayMedium textAlign="center">
            {intl.formatMessage({ id: 'modal__check_the_box_contents' })}
          </Typography.DisplayMedium>
          <Typography.Body2 textAlign="center" color="text-subdued">
            {intl.formatMessage({ id: 'modal__check_the_box_contents_desc' })}
          </Typography.Body2>
        </VStack>

        <Alert
          alertType="error"
          title={intl.formatMessage({
            id: 'alert_only_use_a_recovery_seed_from_device',
          })}
          dismiss={false}
        />
      </VStack>
    </Center>
  );

  return (
    <Modal
      primaryActionTranslationId="action__continue"
      secondaryActionTranslationId="action__contact_us"
      onSecondaryActionPress={() => {
        openUrl(helpCenter);
      }}
      onPrimaryActionPress={() => {
        navigation.navigate(RootRoutes.Modal, {
          screen: ModalRoutes.CreateWallet,
          params: {
            screen: CreateWalletModalRoutes.SetupNewDeviceModal,
            params: {
              device,
              type: 'Restore',
            },
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
