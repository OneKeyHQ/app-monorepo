import { type PropsWithChildren, memo } from 'react';

import { HomeTokenListProviderMirrorBase } from './HomeTokenListProviderMirrorBase';
import { useUrlAccountHomeTokenListContextStoreInitData } from './UrlAccountHomeTokenListProvider';

export const UrlAccountHomeTokenListProviderMirror = memo(
  (props: PropsWithChildren) => {
    const data = useUrlAccountHomeTokenListContextStoreInitData();
    return <HomeTokenListProviderMirrorBase {...props} data={data} />;
  },
);
UrlAccountHomeTokenListProviderMirror.displayName =
  'UrlAccountHomeTokenListProviderMirror';
