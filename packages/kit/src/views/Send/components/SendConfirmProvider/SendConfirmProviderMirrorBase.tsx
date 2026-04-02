import { memo } from 'react';
import type { PropsWithChildren } from 'react';

import { ProviderJotaiContextSendConfirm } from '@onekeyhq/kit/src/states/jotai/contexts/sendConfirm/atoms';
import { jotaiContextStore } from '@onekeyhq/kit/src/states/jotai/utils/jotaiContextStore';
import { JotaiContextStoreMirrorTracker } from '@onekeyhq/kit/src/states/jotai/utils/JotaiContextStoreMirrorTracker';

export const SendConfirmProviderMirrorBase = memo(
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
        <ProviderJotaiContextSendConfirm store={store}>
          {children}
        </ProviderJotaiContextSendConfirm>
      </>
    );
  },
);
SendConfirmProviderMirrorBase.displayName = 'SendConfirmProviderMirrorBase';
