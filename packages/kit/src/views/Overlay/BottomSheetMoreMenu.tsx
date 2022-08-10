import { FC } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  Modal,
  Typography,
  useTheme,
} from '@onekeyhq/components';
import PressableItem from '@onekeyhq/components/src/Pressable/PressableItem';

import { useActiveWalletAccount, useNavigation } from '../../hooks';
import { FiatPayRoutes } from '../../routes/Modal/FiatPay';
import { ModalRoutes, RootRoutes } from '../../routes/routesEnum';
import { showOverlayFactory } from '../../utils/overlayUtils';

export const BottomSheetMoreMenu: FC<{ onClose: () => void }> = ({
  onClose,
  children,
}) => {
  const intl = useIntl();

  return (
    <Modal
      visible
      header={intl.formatMessage({ id: 'action__more' })}
      footer={null}
      closeAction={onClose}
    >
      {children}
    </Modal>
  );
};

const showBottomSheet = showOverlayFactory(BottomSheetMoreMenu);

const MoreSettings: FC = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { network: activeNetwork } = useActiveWalletAccount();
  const { wallet, account } = useActiveWalletAccount();
  const { themeVariant } = useTheme();
  return (
    <Box bg="surface-subdued" flexDirection="column">
      <PressableItem
        display="flex"
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
        py={4}
        px={{ base: 4, md: 6 }}
        onPress={() => {
          if (!account) return;
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.FiatPay,
            params: {
              screen: FiatPayRoutes.SupportTokenListModal,
              params: {
                networkId: activeNetwork?.id ?? '',
              },
            },
          });
        }}
      >
        <Icon name="LockOutline" />
        <Typography.Body1Strong>
          {intl.formatMessage({
            id: 'action__lock_now',
          })}
        </Typography.Body1Strong>
        <Box>
          <Icon name="ChevronRightSolid" size={20} />
        </Box>
      </PressableItem>
    </Box>
  );
};
export const showBottomSheetMoreMenu = () =>
  showBottomSheet({
    children: <MoreSettings />,
  });
