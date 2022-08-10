import { FC, useEffect, useMemo, useRef } from 'react';

import { MessageDescriptor, useIntl } from 'react-intl';
import { Modalize } from 'react-native-modalize';

import {
  Box,
  ICON_NAMES,
  Icon,
  Modal,
  Typography,
  useIsVerticalLayout,
  useThemeValue,
} from '@onekeyhq/components';
import PressableItem from '@onekeyhq/components/src/Pressable/PressableItem';

import { useActiveWalletAccount, useNavigation } from '../../hooks';
import { FiatPayRoutes } from '../../routes/Modal/FiatPay';
import { ModalRoutes, RootRoutes } from '../../routes/routesEnum';
import { gotoScanQrcode } from '../../utils/gotoScanQrcode';
import { showOverlay } from '../../utils/overlayUtils';

export const HomePageMoreMenu: FC<{ closeOverlay: () => void }> = ({
  closeOverlay,
  children,
}) => {
  const modalizeRef = useRef<Modalize>(null);
  const isVerticalLayout = useIsVerticalLayout();
  const intl = useIntl();

  const bg = useThemeValue('surface-subdued');

  useEffect(() => {
    setTimeout(() => modalizeRef.current?.open(), 10);
  }, []);

  return isVerticalLayout ? (
    <Modalize
      ref={modalizeRef}
      onClosed={closeOverlay}
      closeOnOverlayTap
      adjustToContentHeight
      withHandle={false}
      modalStyle={{
        backgroundColor: bg,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
      }}
    >
      <Modal
        visible
        header={intl.formatMessage({ id: 'action__more' })}
        footer={null}
        closeAction={closeOverlay}
        staticChildrenProps={{ padding: 0 }}
      >
        {children}
      </Modal>
    </Modalize>
  ) : (
    <Modal
      visible
      header={intl.formatMessage({ id: 'action__more' })}
      footer={null}
      closeAction={closeOverlay}
    >
      {children}
    </Modal>
  );
};

const MoreSettings: FC<{ closeOverlay: () => void }> = ({ closeOverlay }) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { network: activeNetwork } = useActiveWalletAccount();
  const { account } = useActiveWalletAccount();
  const options: {
    id: MessageDescriptor['id'];
    onPress: () => void;
    icon: ICON_NAMES;
  }[] = useMemo(
    () => [
      {
        id: 'action__scan',
        onPress: () => gotoScanQrcode(),
        icon: 'ScanSolid',
      },
      {
        id: 'action__buy_crypto',
        onPress: () => {
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
        },
        icon: 'TagOutline',
      },
    ],
    [account, activeNetwork?.id, navigation],
  );
  return (
    <Box bg="surface-subdued" flexDirection="column">
      {options.map(({ onPress, icon, id }) => (
        <PressableItem
          key={id}
          flexDirection="row"
          alignItems="center"
          py="16px"
          px="20px"
          onPress={() => {
            closeOverlay();
            onPress();
          }}
        >
          <Icon size={18} name={icon} />
          <Typography.Body1Strong ml="16px">
            {intl.formatMessage({
              id,
            })}
          </Typography.Body1Strong>
        </PressableItem>
      ))}
    </Box>
  );
};

export const showHomePageMoreMenu = () =>
  showOverlay((closeOverlay) => (
    <HomePageMoreMenu closeOverlay={closeOverlay}>
      <MoreSettings closeOverlay={closeOverlay} />
    </HomePageMoreMenu>
  ));
