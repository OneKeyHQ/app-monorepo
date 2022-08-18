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
  Spinner,
  Text,
} from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import LogoWalletConnect from '../../../assets/onboarding/logo_walletconnect.png';
import { CreateWalletModalRoutes } from '../../routes/routesEnum';

import { WalletService } from './types';
import { useMobileRegistryOfWalletServices } from './useMobileRegistryOfWalletServices';
import {
  IConnectToWalletResult,
  useWalletConnectQrcodeModal,
} from './useWalletConnectQrcodeModal';

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
        return <Spinner />;
      }
      return (
        <Hidden from="sm">
          <Icon name="ChevronRightSolid" size={20} />
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
      disabled={!available}
      onPress={onPress}
    >
      <Image
        source={imgSource}
        size={8}
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="border-subdued"
        rounded="xl"
      />
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

export function ConnectWalletListView({
  connectToWalletService,
  uri,
  onConnectResult,
}: {
  connectToWalletService?: (
    walletService: WalletService,
    uri?: string,
  ) => Promise<void>;
  uri?: string;
  onConnectResult?: (result: IConnectToWalletResult) => void;
}) {
  const { data: walletServicesEnabled } = useMobileRegistryOfWalletServices();
  const [loadingId, setLoadingId] = useState('');
  const loadingTimerRef = useRef<any>();
  const { connectToWallet } = useWalletConnectQrcodeModal();

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
      }, 10 * 1000);
      try {
        if (connectToWalletService && uri && walletService) {
          await connectToWalletService(walletService, uri);
        } else {
          const result = await connectToWallet({
            isNewSession: true,
            walletService,
          });
          onConnectResult?.(result);
        }
      } catch (error) {
        debugLogger.common.error(error);
      } finally {
        setLoadingId('');
      }
    },
    [connectToWallet, connectToWalletService, onConnectResult, uri],
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
          label="WalletConenct"
          logoSource={LogoWalletConnect}
          isLoading={loadingId === 'WalletConenctDirectly'}
          onPress={() => doConnect({ itemLoadingId: 'WalletConenctDirectly' })}
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
          <Box flex={1}>
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
