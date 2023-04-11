import type { ComponentProps } from 'react';
import { memo } from 'react';

import { Image } from '@onekeyhq/components';
import type { IAccount } from '@onekeyhq/engine/src/types';
import ImgImToken from '@onekeyhq/kit/assets/onboarding/logo_imtoken.png';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import ImgMetaMask from '@onekeyhq/kit/assets/onboarding/logo_metamask.png';
import { isExternalAccount } from '@onekeyhq/shared/src/engine/engineUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { wait } from '../../../utils/helper';

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
  account,
  walletName,
  size = 6,
  radius = '6',
  ...others
}: ComponentProps<typeof Image> & {
  accountId: string;
  account?: IAccount;
  walletName?: string | null;
  size?: number | string;
  radius?: string;
}) {
  const { serviceExternalAccount } = backgroundApiProxy;
  const { result: accountImg } = usePromiseResult(
    async () => {
      // eslint-disable-next-line no-param-reassign
      accountId = accountId || account?.id || '';
      if (isExternalAccount({ accountId })) {
        let imgInfo = await serviceExternalAccount.getExternalAccountImage({
          accountId,
        });
        // may be simpleDB not saved yet, try again
        if (!imgInfo) {
          await wait(1000);
          imgInfo = await serviceExternalAccount.getExternalAccountImage({
            accountId,
          });
        }
        return imgInfo?.sm || imgInfo?.md || imgInfo?.lg || '';
      }
      return '';
    },
    [accountId, account, walletName],
    { checkIsMounted: true },
  );

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

export default memo(ExternalAccountImg);
