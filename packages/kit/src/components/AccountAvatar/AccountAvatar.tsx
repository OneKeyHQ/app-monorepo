import type { ReactElement } from 'react';
import { isValidElement, useMemo } from 'react';

import { isString } from 'lodash';

import type {
  IImageFallbackProps,
  IImageLoadingProps,
  IImageProps,
  ISkeletonProps,
  SizeTokens,
} from '@onekeyhq/components';
import {
  Icon,
  Image,
  Skeleton,
  Stack,
  withStaticProperties,
} from '@onekeyhq/components';
import type {
  IDBAccount,
  IDBExternalAccount,
  IDBIndexedAccount,
  IDBWallet,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import externalWalletLogoUtils from '@onekeyhq/shared/src/utils/externalWalletLogoUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import { NetworkAvatar } from '../NetworkAvatar';
import { WalletAvatar } from '../WalletAvatar';

import { useBlockieImageUri } from './makeBlockieImageUriList';

import type { ImageStyle } from 'react-native';

const VARIANT_SIZE = {
  'default': {
    containerSize: '$10',
    logoContainerSize: '$5',
    logoSize: '$4',
    relativeMargin: '$6',
  },
  'medium': {
    containerSize: '$8',
    logoContainerSize: '$5',
    logoSize: '$4',
    relativeMargin: '$4',
  },
  'small': {
    containerSize: '$6',
    logoContainerSize: '$4',
    logoSize: '$3',
    relativeMargin: '$3',
  },
};

type IKeyOfVariantSize = keyof typeof VARIANT_SIZE;

export interface IAccountAvatarProps extends IImageProps {
  address?: string;
  size?: IKeyOfVariantSize | SizeTokens;
  networkId?: string;
  account?: INetworkAccount;
  dbAccount?: IDBAccount;
  indexedAccount?: IDBIndexedAccount;
  loading?: ReactElement;
  loadingProps?: IImageLoadingProps;
  fallback?: ReactElement;
  fallbackProps?: IImageFallbackProps;
  wallet?: IDBWallet;
}

const getBlockieImageId = (id?: string) => {
  if (!id) {
    return '';
  }
  return id.replaceAll(':', '');
};

function DefaultImageLoading({
  delayMs = 150,
  ...props
}: { delayMs?: number } & ISkeletonProps) {
  return (
    <Image.Loading delayMs={delayMs}>
      <Skeleton {...props} />
    </Image.Loading>
  );
}

function DefaultImageFallback() {
  return (
    <Image.Fallback
      flex={1}
      bg="$bgStrong"
      alignItems="center"
      justifyContent="center"
    >
      <Icon name="AccountErrorCustom" size="$4.5" color="$textSubdued" />
    </Image.Fallback>
  );
}

function DefaultEmptyAccount() {
  return (
    <Stack flex={1} bg="$bgStrong" alignItems="center" justifyContent="center">
      <Icon name="CrossedSmallSolid" size="$6" />
    </Stack>
  );
}

function BasicAccountAvatar({
  size = 'default',
  src,
  address,
  source,
  account,
  indexedAccount,
  dbAccount,
  loading,
  loadingProps,
  fallback,
  fallbackProps,
  networkId,
  wallet,
  ...restProps
}: IAccountAvatarProps) {
  const isValidSize = !!VARIANT_SIZE[size as IKeyOfVariantSize];
  const { containerSize, logoContainerSize, logoSize, relativeMargin } =
    isValidSize
      ? VARIANT_SIZE[size as IKeyOfVariantSize]
      : {
          ...VARIANT_SIZE.default,
          containerSize: size || VARIANT_SIZE.default.containerSize,
        };

  const accountSourceUri = useBlockieImageUri(
    getBlockieImageId(
      address ||
        indexedAccount?.idHash ||
        indexedAccount?.id ||
        (account || dbAccount)?.address,
    ),
  );

  const uriSource = useMemo(() => {
    const emptyAccountAvatar = <DefaultEmptyAccount />;

    if (address || indexedAccount) {
      return {
        uri: accountSourceUri,
      };
    }
    // dbAccount exists, but network not compatible, so account is undefined
    const finalAccount = account || dbAccount;
    if (finalAccount) {
      if (accountUtils.isExternalAccount({ accountId: finalAccount.id })) {
        const renderExternalAvatar = (logo: string) => {
          if (!logo) {
            return null;
          }
          if (isString(logo)) {
            return { uri: logo };
          }
          return logo;
        };
        const externalAccount = finalAccount as IDBExternalAccount;

        const wcPeerMeta =
          externalAccount?.connectionInfo?.walletConnect?.peerMeta;
        if (wcPeerMeta) {
          const { logo } = externalWalletLogoUtils.getLogoInfoFromWalletConnect(
            {
              peerMeta: wcPeerMeta,
            },
          );
          if (logo) {
            return renderExternalAvatar(logo);
          }
        }

        // TODO move account avatar icon calculation to getAccount() in background
        const externalWalletIcon =
          externalAccount?.connectionInfo?.evmEIP6963?.info?.icon ||
          externalAccount?.connectionInfo?.evmInjected?.icon ||
          externalAccount?.connectionInfo?.walletConnect?.peerMeta?.icons?.[0];
        if (externalWalletIcon) {
          return renderExternalAvatar(externalWalletIcon);
        }

        // some dapps don't provide icons, fallback to walletconnect icon
        // TODO use wcPeerMeta.name or wcPeerMeta.url to find wallet icon
        if (wcPeerMeta || externalAccount?.connectionInfo?.walletConnect) {
          const walletConnectIcon =
            externalWalletLogoUtils.getLogoInfo('walletconnect').logo;
          return renderExternalAvatar(walletConnectIcon);
        }
      }
      return finalAccount.address
        ? {
            uri: accountSourceUri,
          }
        : emptyAccountAvatar;
    }
    if (source || src || fallbackProps) {
      return src ? { uri: src } : source;
    }

    return emptyAccountAvatar;
  }, [
    account,
    accountSourceUri,
    address,
    dbAccount,
    fallbackProps,
    indexedAccount,
    source,
    src,
  ]);

  const renderLoading = useMemo(
    () =>
      loading || loadingProps ? (
        <Image.Loading {...loadingProps} />
      ) : (
        <DefaultImageLoading w={containerSize} h={containerSize} />
      ),
    [containerSize, loading, loadingProps],
  );

  const renderFallback = useMemo(() => {
    // error of externalAccount
    const finalAccount = account || dbAccount;
    if (
      finalAccount &&
      accountUtils.isExternalAccount({ accountId: finalAccount.id })
    ) {
      const externalAccount = finalAccount as IDBExternalAccount;

      if (externalAccount) {
        return <DefaultImageFallback />;
      }
    }
    if (
      address ||
      indexedAccount ||
      account ||
      source ||
      src ||
      loadingProps ||
      loading ||
      fallback ||
      fallbackProps
    ) {
      return (
        fallback ||
        (fallbackProps ? <Image.Fallback {...fallbackProps} /> : null)
      );
    }

    return null;
  }, [
    account,
    address,
    dbAccount,
    fallback,
    fallbackProps,
    indexedAccount,
    loading,
    loadingProps,
    source,
    src,
  ]);

  return (
    <Stack
      w={containerSize}
      h={containerSize}
      justifyContent="center"
      alignItems="center"
    >
      {isValidElement(uriSource) ? (
        uriSource
      ) : (
        <Image
          size={containerSize}
          source={uriSource as IImageProps['source']}
          style={
            {
              borderCurve: 'continuous',
            } as ImageStyle
          }
          borderRadius={size === 'small' ? '$1' : '$2'}
          {...restProps}
          skeleton={renderLoading}
          fallback={renderFallback}
        />
      )}

      {wallet ? (
        <Stack
          position="absolute"
          justifyContent="center"
          alignItems="center"
          height="$5"
          width="$5"
          bottom="$-1.5"
          right="$-1.5"
          zIndex="$1"
        >
          <Stack
            position="absolute"
            top="$0"
            bottom="$0"
            borderCurve="continuous"
            bg="$bgApp"
            {...(wallet.type === 'hw' &&
            !accountUtils.isHwHiddenWallet({ wallet })
              ? { right: '$0.5', left: '$0.5', borderRadius: 2 }
              : { right: '$0', left: '$0', borderRadius: '$1' })}
          />
          <WalletAvatar wallet={wallet} size="$5" />
        </Stack>
      ) : null}
      {networkId ? (
        <Stack
          position="absolute"
          justifyContent="center"
          alignItems="center"
          height={logoContainerSize}
          width={logoContainerSize}
          top={relativeMargin}
          left={relativeMargin}
          bg="$bgApp"
          p="$px"
          borderRadius="$full"
          zIndex="$1"
        >
          <NetworkAvatar networkId={networkId} size={logoSize} />
        </Stack>
      ) : null}
    </Stack>
  );
}

export const AccountAvatar = withStaticProperties(BasicAccountAvatar, {
  Loading: DefaultImageLoading,
});
