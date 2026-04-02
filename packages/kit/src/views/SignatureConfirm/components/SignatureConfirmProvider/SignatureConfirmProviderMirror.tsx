import { type PropsWithChildren, memo } from 'react';

import { SignatureConfirmProviderMirrorBase } from './SignatureConfirmProviderMirrorBase';
import { useSignatureConfirmContextStoreInitData } from './SignatureConfirmRootProvider';

export const SignatureConfirmProviderMirror = memo(
  (props: PropsWithChildren) => {
    const data = useSignatureConfirmContextStoreInitData();
    return <SignatureConfirmProviderMirrorBase {...props} data={data} />;
  },
);
SignatureConfirmProviderMirror.displayName = 'SignatureConfirmProviderMirror';
