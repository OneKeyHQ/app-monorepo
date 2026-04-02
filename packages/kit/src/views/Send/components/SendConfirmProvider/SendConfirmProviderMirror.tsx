import { type PropsWithChildren, memo } from 'react';

import { SendConfirmProviderMirrorBase } from './SendConfirmProviderMirrorBase';
import { useSendConfirmContextStoreInitData } from './SendConfirmRootProvider';

export const SendConfirmProviderMirror = memo((props: PropsWithChildren) => {
  const data = useSendConfirmContextStoreInitData();
  return <SendConfirmProviderMirrorBase {...props} data={data} />;
});
SendConfirmProviderMirror.displayName = 'SendConfirmProviderMirror';
