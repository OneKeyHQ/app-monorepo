import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { RouteProp, useRoute } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { useIntl } from 'react-intl';
import { ImageSourcePropType, StyleSheet } from 'react-native';

import {
  Badge,
  Box,
  Hidden,
  Icon,
  Image,
  Modal,
  Pressable,
  Skeleton,
  Spinner,
  Text,
} from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import LogoWalletConnect from '../../../assets/onboarding/logo_walletconnect.png';
import { CreateWalletModalRoutes } from '../../routes/routesEnum';
import { wait } from '../../utils/helper';
import { useConnectExternalWallet } from '../../views/ExternalAccount/useConnectExternalWallet';

import { WalletService } from './types';
import { useMobileRegistryOfWalletServices } from './useMobileRegistryOfWalletServices';
import { IConnectToWalletResult } from './useWalletConnectQrcodeModal';
import { WALLET_CONNECT_NEW_CONNECTION_BUTTON_LOADING } from './walletConnectConsts';

import type { CreateWalletRoutesParams } from '../../routes';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type NavigationProps = StackNavigationProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.WalletConnectQrcodeModal
>;
type RouteProps = RouteProp<
  CreateWalletRoutesParams,
  CreateWalletModalRoutes.WalletConnectQrcodeModal
>;

export function ConnectWalletListItem({
  label,
  available,
  logo,
  logoSource,
  onPress,
  isLoading,
}: {
  label: string;
  available: boolean;
  logo?: string;
  logoSource?: ImageSourcePropType | undefined;
  onPress: () => void;
  isLoading?: boolean;
}) {
  const intl = useIntl();
  const imgSource = logoSource ?? { uri: logo };
  const extraIcon = useMemo(() => {
    if (available) {
      if (isLoading) {
        return (
          <Hidden from="sm">
            <Spinner />
          </Hidden>
        );
      }
      return (
        <Hidden from="sm">
          <Icon name="ChevronRightMini" size={20} color="icon-subdued" />
        </Hidden>
      );
    }
    return (
      <>
        <Hidden from="sm">
          <Badge
            size="sm"
            title={intl.formatMessage({ id: 'badge__coming_soon' })}
          />
        </Hidden>
        <Hidden till="sm">
          <Text typography="Caption" color="text-subdued">
            {intl.formatMessage({ id: 'badge__coming_soon' })}
          </Text>
        </Hidden>
      </>
    );
  }, [available, intl, isLoading]);
  return (
    <Pressable
      key={label}
      flexDir={{ base: 'row', sm: 'column' }}
      w={{ sm: '1/3' }}
      alignItems="center"
      my={{ base: 1, sm: '18px' }}
      px={2}
      py={{ base: 3, sm: 2 }}
      _hover={{ bgColor: 'surface-hovered' }}
      _pressed={{ bgColor: 'surface-pressed' }}
      rounded="xl"
      disabled={!available || isLoading}
      onPress={onPress}
    >
      {isLoading ? (
        <Skeleton shape="Avatar" size={32} />
      ) : (
        <Image
          source={imgSource}
          size={8}
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="border-subdued"
          rounded="xl"
        />
      )}

      <Text
        flex={1}
        mx={{ base: 3, sm: 0 }}
        mt={{ sm: 2 }}
        typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
        isTruncated
      >
        {label}
      </Text>
      {extraIcon}
    </Pressable>
  );
}

export function InitWalletServicesData() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { data: walletServicesEnabled } = useMobileRegistryOfWalletServices();
  return null;
}

export type IConnectWalletListViewProps = {
  connectToWalletService?: (
    walletService: WalletService,
    uri?: string,
  ) => Promise<void>;
  uri?: string;
  onConnectResult?: (result: IConnectToWalletResult) => void;
};
export function ConnectWalletListView({
  connectToWalletService, // open app directly
  uri,
  onConnectResult,
}: IConnectWalletListViewProps) {
  const { data: walletServicesEnabled } = useMobileRegistryOfWalletServices();
  const [loadingId, setLoadingId] = useState('');
  const loadingTimerRef = useRef<any>();
  const { connectExternalWallet } = useConnectExternalWallet({
    connectToWalletService,
    uri,
    onConnectResult,
  });

  const doConnect = useCallback(
    async (
      {
        walletService,
        itemLoadingId,
      }: { walletService?: WalletService; itemLoadingId: string } = {
        itemLoadingId: '',
      },
    ) => {
      setLoadingId(itemLoadingId || '');
      clearTimeout(loadingTimerRef.current);

      loadingTimerRef.current = setTimeout(() => {
        setLoadingId('');
      }, WALLET_CONNECT_NEW_CONNECTION_BUTTON_LOADING);
      try {
        await connectExternalWallet({
          walletService,
        });
      } catch (error) {
        debugLogger.common.error(error);
      } finally {
        await wait(600);
        setLoadingId('');
      }
    },
    [connectExternalWallet],
  );
  const walletsList = useMemo(() => {
    if (platformEnv.isNativeAndroid) {
      return null;
    }
    return walletServicesEnabled.map((item) => {
      const imgUri =
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        item?.image_url?.sm ||
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        item?.image_url?.md ||
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        item?.image_url?.lg ||
        '';
      return (
        <ConnectWalletListItem
          key={item.id}
          label={item.name}
          available
          logo={imgUri}
          isLoading={loadingId === item.id}
          onPress={() =>
            doConnect({ walletService: item, itemLoadingId: item.id })
          }
        />
      );
    });
  }, [doConnect, loadingId, walletServicesEnabled]);
  return (
    <>
      {walletsList}

      {!platformEnv.isNative || platformEnv.isNativeAndroid ? (
        <ConnectWalletListItem
          available
          label="WalletConnect"
          logoSource={LogoWalletConnect}
          isLoading={loadingId === 'WalletConnectDirectly'}
          onPress={() => doConnect({ itemLoadingId: 'WalletConnectDirectly' })}
        />
      ) : null}
    </>
  );
}

export function WalletConnectQrcodeModal() {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { onDismiss, connectToWalletService, uri } = route.params;
  const defaultClose = useModalClose({
    // onClose: onDismiss,
    fallbackToHome: false,
  });

  useEffect(
    () => () => {
      onDismiss();
    },
    [onDismiss],
  );

  return (
    <Modal
      header={intl.formatMessage({ id: 'title__connect_with' })}
      hidePrimaryAction
      hideSecondaryAction
      closeAction={defaultClose}
      footer={null}
      // onModalClose={onDismiss}

      // TODO use flatListProps instead
      scrollViewProps={{
        py: 0,
        contentContainerStyle: {
          paddingBottom: 0,
          paddingTop: 0,
        },
        children: (
          <Box
            flex={1}
            {...(platformEnv.isNativeIOSPad && {
              flexDir: { sm: 'row' },
              flexWrap: { sm: 'wrap' },
            })}
          >
            <ConnectWalletListView
              connectToWalletService={connectToWalletService}
              uri={uri}
            />
          </Box>
        ),
      }}
    />
  );
}
