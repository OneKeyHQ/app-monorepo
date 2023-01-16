import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

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
import { wait } from '../../utils/helper';
import { useConnectExternalWallet } from '../../views/ExternalAccount/useConnectExternalWallet';

import { useMobileRegistryOfWalletServices } from './useMobileRegistryOfWalletServices';
import { WALLET_CONNECT_NEW_CONNECTION_BUTTON_LOADING } from './walletConnectConsts';

import type { CreateWalletRoutesParams } from '../../routes';
import type { CreateWalletModalRoutes } from '../../routes/routesEnum';
import type { WalletService } from './types';
import type { IConnectToWalletResult } from './useWalletConnectQrcodeModal';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { ImageSourcePropType } from 'react-native';

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
    <Box
      key={label}
      flexDir={{ base: 'row', sm: 'column' }}
      w={{ base: '100%', sm: '1/5' }}
      my={{ base: 1 }}
      alignItems={{ base: 'center', sm: 'stretch' }}
    >
      <Pressable
        bg={{ base: undefined, sm: 'action-secondary-default' }}
        flex={1}
        alignItems="center"
        flexDir={{ base: 'row', sm: 'column' }}
        mx={{ base: 0, sm: 1 }}
        px={2}
        py={{ base: 3, sm: 4 }}
        borderWidth={{ base: 0, sm: StyleSheet.hairlineWidth }}
        borderColor="border-default"
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
          mt={{ base: 0, sm: 3 }}
          typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
          isTruncated
        >
          {label}
        </Text>
        {extraIcon}
      </Pressable>
    </Box>
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
  isInstitutionWallet?: boolean;
  onConnectResult?: (result: IConnectToWalletResult) => void;
};
export function ConnectWalletListView({
  connectToWalletService, // open app directly
  uri,
  onConnectResult,
  isInstitutionWallet,
}: IConnectWalletListViewProps) {
  const { data: walletServicesEnabled, institutionData } =
    useMobileRegistryOfWalletServices();
  const [loadingId, setLoadingId] = useState('');
  const loadingTimerRef = useRef<any>();
  const { connectExternalWallet } = useConnectExternalWallet({
    connectToWalletService,
    uri,
    onConnectResult,
    isInstitutionWallet,
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

  console.log('walletServicesEnabled: ', walletServicesEnabled);
  const walletsList = useMemo(() => {
    if (platformEnv.isNativeAndroid) {
      return null;
    }
    const walletServiceData = isInstitutionWallet
      ? institutionData
      : walletServicesEnabled;
    return walletServiceData.map((item) => {
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
  }, [
    doConnect,
    loadingId,
    walletServicesEnabled,
    institutionData,
    isInstitutionWallet,
  ]);
  return (
    <>
      {walletsList}

      {(!platformEnv.isNative || platformEnv.isNativeAndroid) &&
      !isInstitutionWallet ? (
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
      // call onDismiss when Modal destroy
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
