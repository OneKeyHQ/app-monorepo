import { memo } from 'react';
import type { PropsWithChildren } from 'react';

import { ProviderJotaiContextSignatureConfirm } from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm/atoms';
import { jotaiContextStore } from '@onekeyhq/kit/src/states/jotai/utils/jotaiContextStore';
import { JotaiContextStoreMirrorTracker } from '@onekeyhq/kit/src/states/jotai/utils/JotaiContextStoreMirrorTracker';

export const SignatureConfirmProviderMirrorBase = memo(
  (
    props: PropsWithChildren<{
      data: any;
    }>,
  ) => {
    const { children } = props;

    const store = jotaiContextStore.getOrCreateStore(props.data);

    return (
      <>
        <JotaiContextStoreMirrorTracker {...props.data} />
        <ProviderJotaiContextSignatureConfirm store={store}>
          {children}
        </ProviderJotaiContextSignatureConfirm>
      </>
    );
  },
);
SignatureConfirmProviderMirrorBase.displayName =
  'SignatureConfirmProviderMirrorBase';
