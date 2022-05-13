import React, { FC } from 'react';

import { RouteProp, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Center, Icon, Modal, Typography } from '@onekeyhq/components';
import {
  CreateWalletModalRoutes,
  CreateWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/CreateWallet';

import { useNavigationActions } from '../../../hooks';

type RouteProps = RouteProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.SetupSuccessModal
>;

const SetupSuccessModal: FC = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { resetToRoot } = useNavigationActions();
  // const isSmallScreen = useIsVerticalLayout();

  const { device } = route?.params;

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
          rightIconName="ChevronRightSolid"
        >
          {intl.formatMessage({ id: 'action__view_device_details' })}
        </Button> */}
      </Center>
    </>
  );

  return (
    <Modal
      header={device.device.name ?? ''}
      headerDescription={intl.formatMessage({ id: 'content__activated' })}
      secondaryActionTranslationId="action__close"
      onSecondaryActionPress={resetToRoot}
      staticChildrenProps={{
        flex: '1',
        p: 6,
        px: { base: 4, md: 6 },
      }}
      hidePrimaryAction
    >
      {content}
    </Modal>
  );
};

export default SetupSuccessModal;
