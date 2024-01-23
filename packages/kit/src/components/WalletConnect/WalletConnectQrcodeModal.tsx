import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';
import { Linking, StyleSheet } from 'react-native';

import {
  Box,
  Image,
  Modal,
  Pressable,
  Skeleton,
  Text,
} from '@onekeyhq/components';
import useModalClose from '@onekeyhq/components/src/Modal/Container/useModalClose';
import LogoAmber from '@onekeyhq/kit/assets/onboarding/logo_amber.png';
import LogoCoboWallet from '@onekeyhq/kit/assets/onboarding/logo_cobo_wallet.png';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import LogoWalletConnect from '../../../assets/onboarding/logo_walletconnect.png';
import { wait } from '../../utils/helper';
import { openUrlExternal } from '../../utils/openUrl';
import { useConnectExternalWallet } from '../../views/ExternalAccount/useConnectExternalWallet';

import { useMobileRegistryOfWalletServices } from './useMobileRegistryOfWalletServices';
import {
  WALLET_CONNECT_NEW_CONNECTION_BUTTON_LOADING,
  WALLET_CONNECT_WALLET_NAMES,
} from './walletConnectConsts';

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

const LogoSources: Record<string, any> = {
  Amber: LogoAmber,
  CoboWallet: LogoCoboWallet,
};

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
  const imgSource = logoSource ?? { uri: logo };
  return (
    <Box key={label} w={{ base: '1/2', sm: '1/5' }} p="4px">
      <Pressable
        key={label}
        bg="action-secondary-default"
        flex={1}
        alignItems="center"
        py="16px"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="border-default"
        _hover={{ bgColor: 'action-secondary-hovered' }}
        _pressed={{ bgColor: 'action-secondary-pressed' }}
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
          mt="12px"
          typography={{ sm: 'Body1Strong', md: 'Body2Strong' }}
          isTruncated
        >
          {label}
        </Text>
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
  walletListsCallback?: (dataSource: WalletService[]) => void;
};
export function ConnectWalletListView({
  connectToWalletService, // open app directly
  uri,
  onConnectResult,
  isInstitutionWallet,
  walletListsCallback,
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

  const [registerWalletLists, setRegisterWalletLists] = useState<
    WalletService[]
  >([]);
  useEffect(() => {
    (async () => {
      const walletServiceData = isInstitutionWallet
        ? institutionData
        : walletServicesEnabled;

      if (!platformEnv.isNativeIOS) {
        setRegisterWalletLists(walletServiceData);
        walletListsCallback?.(walletServiceData);
        return;
      }

      const result = [];
      for (const wallet of walletServiceData) {
        try {
          const { mobile = { native: '' } } = wallet;
          let { native: deepLink } = mobile;
          if (deepLink) {
            // 1inch wallet deep link is incorrect
            if (wallet.name === WALLET_CONNECT_WALLET_NAMES['1inch']) {
              deepLink = deepLink.replace('1inch', 'oneinch');
            }
            const canOpen = await Linking.canOpenURL(deepLink);
            if (canOpen) {
              result.push(wallet);
            }
          }
        } catch {
          // ignore
        }
      }

      setRegisterWalletLists(result);
      walletListsCallback?.(result);
    })();
  }, [
    isInstitutionWallet,
    institutionData,
    walletServicesEnabled,
    walletListsCallback,
  ]);

  const walletsList = useMemo(() => {
    if (platformEnv.isNativeAndroid) {
      return null;
    }
    return registerWalletLists.map((item) => {
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
      const logoSource = LogoSources[item.id] || undefined;
      return (
        <ConnectWalletListItem
          key={item.id}
          label={item.name}
          available
          logo={imgUri}
          logoSource={logoSource}
          isLoading={loadingId === item.id}
          onPress={() => {
            if (item.name === 'OKX Wallet') {
              // OKX Wallet not support walletconnect v1
              openUrlExternal('https://www.okx.com/web3');
            } else {
              doConnect({ walletService: item, itemLoadingId: item.id });
            }
          }}
        />
      );
    });
  }, [doConnect, loadingId, registerWalletLists]);
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
        children: (
          <Box flexDir="row" flexWrap="wrap" m="-4px">
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
