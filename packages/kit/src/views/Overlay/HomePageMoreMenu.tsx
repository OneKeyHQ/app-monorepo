import { FC, useEffect, useMemo, useRef } from 'react';

import { MessageDescriptor, useIntl } from 'react-intl';
import { Modalize } from 'react-native-modalize';

import {
  Box,
  ICON_NAMES,
  Icon,
  Modal,
  PresenceTransition,
  Typography,
  useIsVerticalLayout,
  useSafeAreaInsets,
  useThemeValue,
} from '@onekeyhq/components';
import { useDropdownPosition } from '@onekeyhq/components/src/hooks/useDropdownPosition';
import PressableItem from '@onekeyhq/components/src/Pressable/PressableItem';
import { CloseButton, SelectProps } from '@onekeyhq/components/src/Select';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount, useNavigation } from '../../hooks';
import { useCopyAddress } from '../../hooks/useCopyAddress';
import { FiatPayRoutes } from '../../routes/Modal/FiatPay';
import { ModalRoutes, RootRoutes } from '../../routes/routesEnum';
import { gotoScanQrcode } from '../../utils/gotoScanQrcode';
import { showOverlay } from '../../utils/overlayUtils';

const ModalizedMenu: FC<{ closeOverlay: () => void }> = ({
  closeOverlay,
  children,
}) => {
  const modalizeRef = useRef<Modalize>(null);
  const intl = useIntl();

  const bg = useThemeValue('surface-subdued');

  const { bottom } = useSafeAreaInsets();

  useEffect(() => {
    setTimeout(() => modalizeRef.current?.open(), 10);
  }, []);
  return (
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
        staticChildrenProps={{ padding: 0, paddingBottom: bottom }}
      >
        {children}
      </Modal>
    </Modalize>
  );
};

const DesktopMenu: FC<{
  closeOverlay: () => void;
  triggerEle?: SelectProps['triggerEle'];
}> = ({ closeOverlay, children, triggerEle }) => {
  const translateY = 2;
  const contentRef = useRef();
  const { position, toPxPositionValue, isPositionNotReady } =
    useDropdownPosition({
      contentRef,
      triggerEle,
      visible: true,
      translateY,
      dropdownPosition: 'top-right',
    });
  return (
    <Box position="absolute" w="full" h="full">
      <CloseButton onClose={closeOverlay} />
      <PresenceTransition
        visible={!isPositionNotReady}
        initial={{ opacity: 0, translateY: 0 }}
        animate={{
          opacity: 1,
          translateY,
          transition: {
            duration: 150,
          },
        }}
      >
        <Box
          overflow="hidden"
          bg="surface-subdued"
          position="absolute"
          w="240px"
          borderRadius="12px"
          borderWidth={1}
          borderColor="border-subdued"
          ref={contentRef}
          left={toPxPositionValue(position.left)}
          right={toPxPositionValue(position.right)}
          top={toPxPositionValue(position.top)}
          bottom={toPxPositionValue(position.bottom)}
        >
          {children}
        </Box>
      </PresenceTransition>
    </Box>
  );
};

export const HomePageMoreMenu: FC<{
  closeOverlay: () => void;
  triggerEle?: SelectProps['triggerEle'];
}> = (props) => {
  const isVerticalLayout = useIsVerticalLayout();

  return isVerticalLayout ? (
    <ModalizedMenu {...props} />
  ) : (
    <DesktopMenu {...props} />
  );
};

const MoreSettings: FC<{ closeOverlay: () => void }> = ({ closeOverlay }) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { network, account, wallet } = useActiveWalletAccount();
  const { copyAddress } = useCopyAddress(wallet);

  const isVerticalLayout = useIsVerticalLayout();
  // https://www.figma.com/file/vKm9jnpi3gfoJxZsoqH8Q2?node-id=489:30375#244559862
  const disableScan = platformEnv.isWeb && !isVerticalLayout;
  const options: (
    | {
        id: MessageDescriptor['id'];
        onPress: () => void;
        icon: ICON_NAMES;
      }
    | false
    | undefined
  )[] = useMemo(
    () => [
      !disableScan && {
        id: 'action__scan',
        onPress: () => gotoScanQrcode(),
        icon: 'ScanSolid',
      },
      // TODO Connected Sites
      {
        id: 'action__buy_crypto',
        onPress: () => {
          if (!account) return;
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.FiatPay,
            params: {
              screen: FiatPayRoutes.SupportTokenListModal,
              params: {
                networkId: network?.id ?? '',
              },
            },
          });
        },
        icon: isVerticalLayout
          ? 'CurrencyDollarOutline'
          : 'CurrencyDollarSolid',
      },
      {
        id: 'action__sell_crypto',
        onPress: () => {
          if (!account) return;
          navigation.navigate(RootRoutes.Modal, {
            screen: ModalRoutes.FiatPay,
            params: {
              screen: FiatPayRoutes.SupportTokenListModal,
              params: {
                networkId: network?.id ?? '',
                type: 'Sell',
              },
            },
          });
        },
        icon: isVerticalLayout ? 'CashOutline' : 'CashSolid',
      },
      platformEnv.isExtensionUiPopup && {
        id: 'form__expand_view',
        onPress: () => {
          backgroundApiProxy.serviceApp.openExtensionExpandTab({
            routes: '',
          });
        },
        icon: 'ArrowsExpandOutline',
      },
      {
        id: 'action__copy_address',
        onPress: () => {
          copyAddress(account?.address);
        },
        icon: isVerticalLayout ? 'DuplicateOutline' : 'DuplicateSolid',
      },
      // TODO Share
    ],
    [
      disableScan,
      isVerticalLayout,
      account,
      navigation,
      network?.id,
      copyAddress,
    ],
  );
  return (
    <Box bg="surface-subdued" flexDirection="column">
      {options.filter(Boolean).map(({ onPress, icon, id }) => (
        <PressableItem
          key={id}
          flexDirection="row"
          alignItems="center"
          py="16px"
          px="20px"
          bg="transparent"
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

export const showHomePageMoreMenu = (triggerEle?: SelectProps['triggerEle']) =>
  showOverlay((closeOverlay) => (
    <HomePageMoreMenu triggerEle={triggerEle} closeOverlay={closeOverlay}>
      <MoreSettings closeOverlay={closeOverlay} />
    </HomePageMoreMenu>
  ));
