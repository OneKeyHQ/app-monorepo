import type { FC } from 'react';
import { useState } from 'react';

import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  Box,
  Dialog,
  Pressable,
  Toast,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { BackupWalletModalRoutes } from '@onekeyhq/kit/src/routes/routesEnum';

import useAppNavigation from '../../../hooks/useAppNavigation';
import { ModalRoutes, RootRoutes } from '../../../routes/types';

type BackupToastProps = {
  walletId: string;
  onClose: () => void;
};
const BackupToast: FC<BackupToastProps> = ({ onClose, walletId }) => {
  const intl = useIntl();
  const [visible, setVisible] = useState(false);
  const navigation = useAppNavigation();
  const isSmallScreen = useIsVerticalLayout();
  const screenWidth = useWindowDimensions().width;
  return (
    <>
      <Box
        position="absolute"
        width={isSmallScreen ? `${screenWidth - 32}px` : '358px'}
        top={isSmallScreen ? undefined : '32px'}
        right={isSmallScreen ? '16px' : '32px'}
        bottom={isSmallScreen ? '28px' : undefined}
        justifyContent="center"
        alignItems="center"
      >
        <Pressable
          onPress={() => {
            setTimeout(() => {
              navigation.navigate(RootRoutes.Modal, {
                screen: ModalRoutes.BackupWallet,
                params: {
                  screen: BackupWalletModalRoutes.BackupWalletOptionsModal,
                  params: {
                    walletId: walletId ?? '',
                  },
                },
              });
            }, 100);
          }}
        >
          <Toast
            width={isSmallScreen ? `${screenWidth - 32}px` : '358px'}
            onClose={() => {
              setVisible(true);
            }}
            dismiss
            status="warning"
            title={intl.formatMessage({ id: 'modal_remind_back_up_wallet' })}
            description={intl.formatMessage({
              id: 'modal_remind_back_up_wallet_desc',
            })}
          />
        </Pressable>
      </Box>
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
            if (onClose) {
              onClose();
            }
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
export default BackupToast;
