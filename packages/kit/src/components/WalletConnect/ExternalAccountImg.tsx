/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { ComponentProps } from 'react';

import { Image } from '@onekeyhq/components';
import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import { isExternalAccount } from '@onekeyhq/engine/src/engineUtils';
import ImgImToken from '@onekeyhq/kit/assets/onboarding/logo_imtoken.png';
import ImgMetaMask from '@onekeyhq/kit/assets/onboarding/logo_metamask.png';

import { usePromiseResult } from '../../hooks/usePromiseResult';
import { wait } from '../../utils/helper';

export function MockExternalAccountImg(props: ComponentProps<typeof Image>) {
  const source = ImgImToken;

  return (
    <Image
      // key={accountId}
      source={source}
      w={6}
      h={6}
      borderRadius="6px"
      {...props}
    />
  );
}

function ExternalAccountImg({
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
      let imgInfo = await simpleDb.walletConnect.getExternalAccountImage({
        accountId,
      });
      // may be simpleDB not saved yet, try again
      if (!imgInfo) {
        await wait(1000);
        imgInfo = await simpleDb.walletConnect.getExternalAccountImage({
          accountId,
        });
      }
      return imgInfo?.sm || imgInfo?.md || imgInfo?.lg || '';
    }
    return '';
  }, [accountId]);

  if (accountImg) {
    // return null;
    // const source = ImgMetaMask;
    const source = { uri: accountImg };

    return (
      <Image
        key={accountImg}
        source={source}
        w={size}
        h={size}
        borderRadius={radius}
        {...others}
      />
    );
  }
  return null;
  // return <MockExternalAccountImg {...others} />;
}

export default React.memo(ExternalAccountImg);
