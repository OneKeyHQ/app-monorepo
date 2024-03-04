import type { ReactElement } from 'react';
import { memo, useMemo } from 'react';

import { withStaticProperties } from 'tamagui';

import { Image, Skeleton, Stack } from '@onekeyhq/components';
import type {
  IImageFallbackProps,
  IImageProps,
  ISkeletonProps,
  SizeTokens,
} from '@onekeyhq/components';
import type {
  IDBAccount,
  IDBIndexedAccount,
} from '@onekeyhq/kit-bg/src/dbs/local/types';

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
  account?: IDBAccount;
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
  const content = useMemo(() => {
    if (address) {
      return <MemoHashImageSource id={address} />;
    }
    if (indexedAccount) {
      return (
        <MemoHashImageSource id={indexedAccount.idHash || indexedAccount.id} />
      );
    }
    if (account) {
      return <MemoHashImageSource id={account.address} />;
    }
    return <Image.Source src={src} source={source} />;
  }, [account, address, indexedAccount, source, src]);
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
        {content}
        {fallback ||
          (fallbackProps ? (
            <Image.Fallback {...fallbackProps} />
          ) : (
            <Fallback w={containerSize} h={containerSize} />
          ))}
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
