import type { ReactElement } from 'react';
import { memo } from 'react';

import { withStaticProperties } from 'tamagui';

import { Image, Skeleton, Stack } from '@onekeyhq/components';
import type {
  IImageFallbackProps,
  IImageProps,
  ISkeletonProps,
} from '@onekeyhq/components';
import type {
  IDBAccount,
  IDBIndexedAccount,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import { serverPresetNetworks } from '@onekeyhq/shared/src/config/presetNetworks';

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
  size?: IKeyOfVariantSize;
  chain?: string;
  account?: IDBIndexedAccount | IDBAccount;
  fallback?: ReactElement;
  fallbackProps?: IImageFallbackProps;
}

function HashImageSource({ id }: { id: string }) {
  const { uri } = useBlockieImageUri(id);
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

function BasicAccountAvatar({
  size = 'default',
  src,
  source,
  account,
  fallback,
  fallbackProps,
  circular,
  chain,
  ...restProps
}: IAccountAvatarProps) {
  const { containerSize, logoContainerSize, logoSize, relativeMargin } =
    VARIANT_SIZE[size] || VARIANT_SIZE.default;
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
        {...(circular ? { circular: true } : { borderRadius: '$2' })}
        {...restProps}
      >
        {account ? (
          <MemoHashImageSource
            id={(account as IDBIndexedAccount).idHash || account.id}
          />
        ) : (
          <Image.Source src={src} source={source} />
        )}
        {fallback ||
          (fallbackProps ? (
            <Image.Fallback {...fallbackProps} />
          ) : (
            <Fallback w={containerSize} h={containerSize} />
          ))}
      </Image>

      {chain ? (
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
          <Image
            size={logoSize}
            src={serverPresetNetworks.find((i) => i.code === chain)?.logoURI}
          />
        </Stack>
      ) : null}
    </Stack>
  );
}

export const AccountAvatar = withStaticProperties(BasicAccountAvatar, {
  Fallback,
});
