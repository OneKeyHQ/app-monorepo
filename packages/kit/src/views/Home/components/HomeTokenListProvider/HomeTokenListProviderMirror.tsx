import { type PropsWithChildren, memo } from 'react';

import { HomeTokenListProviderMirrorBase } from './HomeTokenListProviderMirrorBase';
import { useHomeTokenListContextStoreInitData } from './HomeTokenListRootProvider';

export const HomeTokenListProviderMirror = memo((props: PropsWithChildren) => {
  const data = useHomeTokenListContextStoreInitData();
  return <HomeTokenListProviderMirrorBase {...props} data={data} />;
});
HomeTokenListProviderMirror.displayName = 'HomeTokenListProviderMirror';
