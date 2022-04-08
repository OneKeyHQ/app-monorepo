import React, { FC, useState } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Button,
  Center,
  Dialog,
  Icon,
  Modal,
  Text,
} from '@onekeyhq/components';
import { BackupWalletModalRoutes } from '@onekeyhq/kit/src/routes/Modal/BackupWallet';
import {
  CreateWalletModalRoutes,
  CreateWalletRoutesParams,
} from '@onekeyhq/kit/src/routes/Modal/CreateWallet';

import { ModalRoutes, RootRoutes } from '../../routes/types';

type RouteProps = RouteProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.BackupTipsModal
>;

const BackupTips: FC = () => {
  const intl = useIntl();
  const [visible, setVisible] = useState(false);
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { walletId } = route.params;
  return (
    <>
      <Modal
        modalHeight="404px"
        footer={null}
        closeAction={() => {
          setVisible(true);
        }}
      >
        <Center flex={1}>
          <Center
            height="56px"
            width="56px"
            bgColor="decorative-surface-one"
            borderRadius="28px"
          >
            <Icon name="ShieldCheckOutline" color="decorative-icon-one" />
          </Center>
          <Text
            typography={{ sm: 'DisplayLarge', md: 'DisplayMedium' }}
            mt="24px"
          >
            {intl.formatMessage({ id: 'modal_remind_back_up_wallet' })}
          </Text>
          <Text
            typography={{ sm: 'Body1', md: 'Body2' }}
            mt="24px"
            color="text-subdued"
            textAlign="center"
          >
            {intl.formatMessage({ id: 'modal_remind_back_up_wallet_desc' })}
          </Text>
          <Button
            type="primary"
            size="xl"
            mt="48px"
            height="50px"
            width="100%"
            onPress={() => {
              navigation.getParent()?.goBack();
              setTimeout(() => {
                navigation.navigate(RootRoutes.Modal, {
                  screen: ModalRoutes.BackupWallet,
                  params: {
                    screen: BackupWalletModalRoutes.BackupWalletModal,
                    params: {
                      walletId,
                    },
                  },
                });
              }, 100);
            }}
          >
            {intl.formatMessage({ id: 'action__back_up_now' })}
          </Button>
        </Center>
      </Modal>
      <Dialog
        hasFormInsideDialog
        visible={visible}
        contentProps={{
          iconType: 'danger',
          title: intl.formatMessage({ id: 'dialog__skip_backup' }),
          content: intl.formatMessage({
            id: 'modal_remind_back_up_wallet_desc',
          }),
        }}
        footerButtonProps={{
          primaryActionTranslationId: 'action__skip',
          secondaryActionTranslationId: 'action__cancel',
          onPrimaryActionPress: () => {
            setVisible(false);
            setTimeout(() => navigation.goBack(), 500);
          },
          primaryActionProps: {
            type: 'destructive',
          },
        }}
        onClose={() => setVisible(!visible)}
      />
    </>
  );
};

export default BackupTips;
