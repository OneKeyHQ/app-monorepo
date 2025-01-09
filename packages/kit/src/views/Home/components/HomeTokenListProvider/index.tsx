import { type PropsWithChildren } from 'react';

import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

import { HomeTokenListProviderMirror } from './HomeTokenListProviderMirror';
import { UrlAccountHomeTokenListProviderMirror } from './UrlAccountHomeTokenListProviderMirror';

function HomeTokenListProviderMirrorWrapper({
  accountId,
  ...props
}: { accountId: string } & PropsWithChildren) {
  const isUrlAccount = accountUtils.isUrlAccountFn({
    accountId,
  });
  return isUrlAccount ? (
    <UrlAccountHomeTokenListProviderMirror {...props} />
  ) : (
    <HomeTokenListProviderMirror {...props} />
  );
}

export { HomeTokenListProviderMirrorWrapper };
