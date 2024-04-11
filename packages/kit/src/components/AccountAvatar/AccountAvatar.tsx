import type { ReactElement } from 'react';
import { memo, useMemo } from 'react';

import type {
  IIconProps,
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
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import externalWalletLogoUtils from '@onekeyhq/shared/src/utils/externalWalletLogoUtils';
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import { NetworkAvatar } from '../NetworkAvatar';

import { useBlockieImageUri } from './makeBlockieImageUriList';

import type { ImageStyle } from 'react-native';

const VARIANT_SIZE = {
  'default': {
    containerSize: '$10',
    logoContainerSize: '$5',
    logoSize: '$4',
    relativeMargin: '$6',
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
}

function HashImageSource({ id }: { id: string }) {
  const uri = useBlockieImageUri(id);
  return uri ? <Image.Source src={uri} /> : null;
}

const MemoHashImageSource = memo(HashImageSource);

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
  circular,
  networkId,
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

  const renderContent = useMemo(() => {
    const emptyAccountAvatar = <DefaultEmptyAccount />;

    if (address) {
      return <MemoHashImageSource id={address} />;
    }
    if (indexedAccount) {
      return (
        <MemoHashImageSource id={indexedAccount.idHash || indexedAccount.id} />
      );
    }
    // dbAccount exists, but network not compatible, so account is undefined
    const finalAccount = account || dbAccount;
    if (finalAccount) {
      if (accountUtils.isExternalAccount({ accountId: finalAccount.id })) {
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
            return <Image.Source src={logo} />;
          }
        }

        // TODO move account avatar icon calculation to getAccount() in background
        const externalWalletIcon =
          externalAccount?.connectionInfo?.evmEIP6963?.info?.icon ||
          externalAccount?.connectionInfo?.evmInjected?.icon ||
          externalAccount?.connectionInfo?.walletConnect?.peerMeta?.icons?.[0];
        if (externalWalletIcon) {
          return <Image.Source src={externalWalletIcon} />;
        }

        // some dapps don't provide icons, fallback to walletconnect icon
        // TODO use wcPeerMeta.name or wcPeerMeta.url to find wallet icon
        if (wcPeerMeta || externalAccount?.connectionInfo?.walletConnect) {
          const walletConnectIcon =
            externalWalletLogoUtils.getLogoInfo('walletconnect').logo;
          return <Image.Source src={walletConnectIcon} />;
        }
      }
      return finalAccount.address ? (
        <MemoHashImageSource id={finalAccount.address} />
      ) : (
        emptyAccountAvatar
      );
    }
    if (source || src || fallbackProps) {
      return <Image.Source src={src} source={source} />;
    }

    return emptyAccountAvatar;
  }, [account, address, dbAccount, fallbackProps, indexedAccount, source, src]);

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
      loading
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
      <Image
        size={containerSize}
        style={
          {
            borderCurve: 'continuous',
          } as ImageStyle
        }
        borderRadius={size === 'small' ? '$1' : '$2'}
        {...restProps}
      >
        {renderContent}
        {renderFallback}
        {renderLoading}
      </Image>

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
