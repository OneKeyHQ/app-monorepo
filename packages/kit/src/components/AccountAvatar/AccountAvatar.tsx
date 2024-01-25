import type { ReactElement } from 'react';
import { memo } from 'react';

import { withStaticProperties } from 'tamagui';

import { Image, Skeleton } from '@onekeyhq/components';
import type {
  IImageFallbackProps,
  IImageProps,
  ISkeletonProps,
} from '@onekeyhq/components';
import type {
  IDBAccount,
  IDBIndexedAccount,
} from '@onekeyhq/kit-bg/src/dbs/local/types';

import { useBlockieImageUri } from './makeBlockieImageUriList';

import type { ImageStyle } from 'react-native';

export interface IAccountAvatarProps extends IImageProps {
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
  src,
  source,
  account,
  fallback,
  fallbackProps,
  circular,
  ...restProps
}: IAccountAvatarProps) {
  return (
    <Image
      size="$10"
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
        (fallbackProps ? <Image.Fallback {...fallbackProps} /> : <Fallback />)}
    </Image>
  );
}

export const AccountAvatar = withStaticProperties(BasicAccountAvatar, {
  Fallback,
});
