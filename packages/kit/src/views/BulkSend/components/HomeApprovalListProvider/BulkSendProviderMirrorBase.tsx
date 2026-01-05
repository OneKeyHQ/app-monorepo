import { memo } from 'react';
import type { PropsWithChildren } from 'react';

import { ProviderJotaiContextBulkSend } from '@onekeyhq/kit/src/states/jotai/contexts/bulkSend/atoms';
import { jotaiContextStore } from '@onekeyhq/kit/src/states/jotai/utils/jotaiContextStore';
import { JotaiContextStoreMirrorTracker } from '@onekeyhq/kit/src/states/jotai/utils/JotaiContextStoreMirrorTracker';

export const BulkSendProviderMirrorBase = memo(
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
        <ProviderJotaiContextBulkSend store={store}>
          {children}
        </ProviderJotaiContextBulkSend>
      </>
    );
  },
);
BulkSendProviderMirrorBase.displayName = 'BulkSendProviderMirrorBase';
