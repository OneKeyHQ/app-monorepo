import { type PropsWithChildren, memo } from 'react';

import { BulkSendProviderMirrorBase } from './BulkSendProviderMirrorBase';
import { useBulkSendContextStoreInitData } from './BulkSendRootProvider';

export const BulkSendProviderMirror = memo((props: PropsWithChildren) => {
  const data = useBulkSendContextStoreInitData();
  return <BulkSendProviderMirrorBase {...props} data={data} />;
});
BulkSendProviderMirror.displayName = 'BulkSendProviderMirror';
