import type { FC } from 'react';

import { useNavigation } from '@react-navigation/native';
import { AnimatePresence, MotiView } from 'moti';
import { useIntl } from 'react-intl';
import { Rect } from 'react-native-svg';

import {
  Box,
  Button,
  Icon,
  Pressable,
  Skeleton,
  Typography,
  useIsVerticalLayout,
} from '@onekeyhq/components';

import { useActiveWalletAccount, useAppSelector } from '../../../hooks';
import { useWalletName } from '../../../hooks/useWalletName';
import { RootRoutes } from '../../../routes/routesEnum';
import { useDeviceStatusOfHardwareWallet } from '../../NetworkAccountSelector/hooks/useDeviceStatusOfHardwareWallet';
import { WalletAvatarPro } from '../WalletAvatar';

import type { CreateWalletRoutesParams } from '../../../routes';
import type { ModalScreenProps } from '../../../routes/types';

type NavigationProps = ModalScreenProps<CreateWalletRoutesParams>;
export type WalletSelectorTriggerElementProps = {
  visible: boolean;
  showWalletName?: boolean;
  handleToggleVisible: () => void;
};

export const WalletSelectorTriggerElement: FC<
  WalletSelectorTriggerElementProps
> = ({ visible, showWalletName, handleToggleVisible }) => {
  const intl = useIntl();
  const isVerticalLayout = useIsVerticalLayout();
  const { wallet } = useActiveWalletAccount();
  const navigation = useNavigation<NavigationProps['navigation']>();
  const isLoading = useAppSelector((s) => s.accountSelector.isLoading);
  const walletName = useWalletName({ wallet });
  const { devicesStatus } = useDeviceStatusOfHardwareWallet();

  if (!wallet) {
    return (
      <Button
        onPress={() => {
          navigation.navigate(RootRoutes.Onboarding);
        }}
      >
        {intl.formatMessage({ id: 'action__create_wallet' })}
      </Button>
    );
  }

  // const { name } = account;
  const name = walletName || 'Wallet';
  // ** Android will crash after account switch
  // const showExternalImg = true;
  return (
    <Pressable onPress={handleToggleVisible} hitSlop={8} w="full">
      {({ isHovered }) => (
        <Box
          flexDirection="row"
          alignItems="center"
          m={{ base: -1, md: undefined }}
          p={1}
          pr={{ base: 1, md: 2 }}
          borderRadius="12px"
          bg={
            // eslint-disable-next-line no-nested-ternary
            visible && !isVerticalLayout
              ? 'surface-selected'
              : isHovered
              ? 'surface-hovered'
              : 'transparent'
          }
        >
          <Box>
            {isLoading ? (
              <Box size={8}>
                <Skeleton size={32}>
                  <Rect x="0" y="0" width="32" height="32" rx="12" ry="12" />
                </Skeleton>
              </Box>
            ) : (
              <WalletAvatarPro
                wallet={wallet}
                devicesStatus={devicesStatus}
                size="sm"
              />
            )}
          </Box>
          <AnimatePresence initial={false}>
            {showWalletName && (
              <MotiView
                from={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{
                  opacity: 0,
                }}
                transition={{
                  type: 'timing',
                  duration: 150,
                }}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <Typography.Body2Strong flex={1} isTruncated ml={3} mr={1}>
                  {name}
                </Typography.Body2Strong>
                <Box>
                  <Icon
                    size={20}
                    name="ChevronUpDownMini"
                    color="icon-subdued"
                  />
                </Box>
              </MotiView>
            )}
          </AnimatePresence>
        </Box>
      )}
    </Pressable>
  );
};
