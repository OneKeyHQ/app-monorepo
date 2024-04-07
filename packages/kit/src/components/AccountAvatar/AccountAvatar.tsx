import type { ReactElement } from 'react';
import { memo, useMemo } from 'react';

import type {
  IImageFallbackProps,
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
import type { INetworkAccount } from '@onekeyhq/shared/types/account';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../hooks/usePromiseResult';

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
  fallback?: ReactElement;
  fallbackProps?: IImageFallbackProps;
}

function HashImageSource({ id }: { id: string }) {
  const uri = useBlockieImageUri(id);
  return uri ? <Image.Source src={uri} /> : null;
}

const MemoHashImageSource = memo(HashImageSource);

function Fallback({
  delayMs = 150,
  ...props
}: { delayMs?: number } & ISkeletonProps) {
  return (
    <Image.Fallback delayMs={delayMs}>
      <Skeleton {...props} />
    </Image.Fallback>
  );
}

function ChainImage({
  networkId,
  size,
}: {
  networkId?: string;
  size: IImageProps['size'];
}) {
  const { serviceNetwork } = backgroundApiProxy;
  const res = usePromiseResult(
    () =>
      networkId
        ? serviceNetwork.getNetwork({ networkId })
        : Promise.resolve({ logoURI: '' }),
    [networkId, serviceNetwork],
  );
  const { logoURI } = res.result || {};
  return logoURI ? <Image size={size} src={logoURI} /> : null;
}

function BasicAccountAvatar({
  size = 'default',
  src,
  address,
  source,
  account,
  indexedAccount,
  dbAccount,
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
    const emptyAccountAvatar = (
      <Stack
        flex={1}
        bg="$bgStrong"
        alignItems="center"
        justifyContent="center"
      >
        <Icon name="CrossedSmallSolid" size="$6" />
      </Stack>
    );

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
        const wcSrc = wcPeerMeta?.icons?.[0];
        if (wcSrc) {
          return <Image.Source src={wcSrc} />;
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
          return (
            <Image.Source
              source={require('@onekeyhq/kit/assets/onboarding/logo_walletconnect.png')}
            />
          );
        }
      }
      return finalAccount.address ? (
        <MemoHashImageSource id={finalAccount.address} />
      ) : (
        emptyAccountAvatar
      );
    }
    if (source || src) {
      return <Image.Source src={src} source={source} />;
    }
    return emptyAccountAvatar;
  }, [account, address, dbAccount, indexedAccount, source, src]);

  const renderFallback = useMemo(() => {
    if (address || indexedAccount || account || source || src) {
      return (
        fallback ||
        (fallbackProps ? (
          <Image.Fallback {...fallbackProps} />
        ) : (
          <Fallback w={containerSize} h={containerSize} />
        ))
      );
    }
    return null;
  }, [
    account,
    address,
    containerSize,
    fallback,
    fallbackProps,
    indexedAccount,
    source,
    src,
  ]);

  // return <Image.Source src={src} source={source} />;
  // }, [account, address, dbAccount, indexedAccount, source, src]);

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
          <ChainImage networkId={networkId} size={logoSize} />
        </Stack>
      ) : null}
    </Stack>
  );
}

export const AccountAvatar = withStaticProperties(BasicAccountAvatar, {
  Fallback,
});
