import type { FC } from 'react';
import { useCallback } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Center, Icon, Modal, Typography } from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import type { CreateWalletRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/CreateWallet';

import { useNavigationActions } from '../../../hooks';
import {
  closeExtensionWindowIfOnboardingFinished,
  useOnboardingDone,
} from '../../../hooks/useOnboardingRequired';
import { wait } from '../../../utils/helper';

import type { CreateWalletModalRoutes } from '../../../routes/routesEnum';
import type { RouteProp } from '@react-navigation/core';

type RouteProps = RouteProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.SetupSuccessModal
>;

const SetupSuccessModal: FC = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { openRootHome } = useNavigationActions();
  const closeModal = useModalClose();
  const onboardingDone = useOnboardingDone();

  // const isSmallScreen = useIsVerticalLayout();

  const { device, onPressOnboardingFinished } = route?.params || {};

  const content = (
    <>
      <Center flex={1}>
        <Center bg="surface-success-default" borderRadius="full" size="56px">
          <Icon name="CheckOutline" color="icon-success" />
        </Center>
        <Typography.DisplayMedium mt={6}>
          {intl.formatMessage({ id: 'modal__setup_complete' })}
        </Typography.DisplayMedium>
        <Typography.Body1 color="text-subdued" textAlign="center" mt={2}>
          {intl.formatMessage({ id: 'modal__setup_complete_desc' })}
        </Typography.Body1>
      </Center>
      <Center>
        {/* <Button
          type="plain"
          size={isSmallScreen ? 'lg' : 'base'}
          mt={6}
          rightIconName="ChevronRightMini"
        >
          {intl.formatMessage({ id: 'action__view_device_details' })}
        </Button> */}
      </Center>
    </>
  );

  const onPressClose = useCallback(async () => {
    // close current SetupSuccess modal
    closeModal();

    if (onPressOnboardingFinished) {
      await wait(2000);
      onPressOnboardingFinished?.();
    } else {
      // close onboarding routes ( including openRootHome() )
      // ** not working for Android first time onBoarding
      onboardingDone({ delay: 600 });
    }
  }, [closeModal, onPressOnboardingFinished, onboardingDone]);

  return (
    <Modal
      header={device.name ?? ''}
      headerDescription={intl.formatMessage({ id: 'content__activated' })}
      secondaryActionTranslationId="action__close"
      secondaryActionProps={{
        onPress: onPressClose,
      }}
      staticChildrenProps={{
        flex: '1',
        p: 6,
        px: { base: 4, md: 6 },
      }}
      hidePrimaryAction
      onModalClose={() => {
        closeExtensionWindowIfOnboardingFinished();
      }}
    >
      {content}
    </Modal>
  );
};

export default SetupSuccessModal;
