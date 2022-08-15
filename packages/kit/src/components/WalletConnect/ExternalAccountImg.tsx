import React, { ComponentProps } from 'react';

import { Image } from '@onekeyhq/components';
import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import { isExternalAccount } from '@onekeyhq/engine/src/engineUtils';

import { usePromiseResult } from '../../hooks/usePromiseResult';

export function ExternalAccountImg({
  accountId,
  size = 6,
  radius = '6px',
  ...others
}: ComponentProps<typeof Image> & {
  accountId: string;
  size?: number | string;
  radius?: string;
}) {
  const { result: accountImg } = usePromiseResult(async () => {
    if (isExternalAccount({ accountId })) {
      const imgInfo = await simpleDb.walletConnect.getExternalAccountImage({
        accountId,
      });
      return imgInfo?.sm || imgInfo?.md || imgInfo?.lg || '';
    }
    return '';
  });

  if (accountImg) {
    return (
      <Image
        key={accountId}
        source={{ uri: accountImg }}
        w={size}
        h={size}
        borderRadius={radius}
        {...others}
      />
    );
  }
  return null;
}
