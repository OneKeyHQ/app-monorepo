import { FC, useMemo } from 'react';

import { MessageDescriptor, useIntl } from 'react-intl';

import {
  Box,
  ICON_NAMES,
  Icon,
  Text,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import PressableItem from '@onekeyhq/components/src/Pressable/PressableItem';
import { formatMessage } from '@onekeyhq/components/src/Provider';
import { SelectProps } from '@onekeyhq/components/src/Select';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useActiveWalletAccount, useNavigation } from '../../hooks';
import { useCopyAddress } from '../../hooks/useCopyAddress';
import { FiatPayRoutes } from '../../routes/Modal/FiatPay';
import { ModalRoutes, RootRoutes } from '../../routes/routesEnum';
import { gotoScanQrcode } from '../../utils/gotoScanQrcode';
import { showOverlay } from '../../utils/overlayUtils';

import { OverlayPanel } from './OverlayPanel';

const MoreSettings: FC<{ closeOverlay: () => void }> = ({ closeOverlay }) => {
  const intl = useIntl();
  const navigation = useNavigation();
  const { network, account, wallet } = useActiveWalletAccount();
  const { copyAddress } = useCopyAddress({ wallet });

  const isVerticalLayout = useIsVerticalLayout();
  // https://www.figma.com/file/vKm9jnpi3gfoJxZsoqH8Q2?node-id=489:30375#244559862
  const disableScan = platformEnv.isWeb && !isVerticalLayout;

  const walletType = wallet?.type;
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
      walletType !== 'watching' && {
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
        icon: isVerticalLayout ? 'PlusOutline' : 'PlusSolid',
      },
      walletType !== 'watching' && {
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
          setTimeout(() => {
            copyAddress(account?.address);
          });
        },
        icon: isVerticalLayout ? 'DuplicateOutline' : 'DuplicateSolid',
      },
      // TODO Share
    ],
    [
      disableScan,
      walletType,
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
          py={{ base: '12px', sm: '8px' }}
          px={{ base: '16px', sm: '8px' }}
          bg="transparent"
          borderRadius="12px"
          onPress={() => {
            closeOverlay();
            onPress();
          }}
        >
          <Icon size={isVerticalLayout ? 24 : 20} name={icon} />
          <Text
            typography={isVerticalLayout ? 'Body1Strong' : 'Body2Strong'}
            ml="12px"
          >
            {intl.formatMessage({
              id,
            })}
          </Text>
        </PressableItem>
      ))}
    </Box>
  );
};

export const showHomePageMoreMenu = (triggerEle?: SelectProps['triggerEle']) =>
  showOverlay((closeOverlay) => (
    <OverlayPanel
      triggerEle={triggerEle}
      closeOverlay={closeOverlay}
      modalProps={{
        header: formatMessage({ id: 'action__more' }),
      }}
    >
      <MoreSettings closeOverlay={closeOverlay} />
    </OverlayPanel>
  ));
