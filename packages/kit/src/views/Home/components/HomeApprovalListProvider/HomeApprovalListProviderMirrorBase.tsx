import { memo } from 'react';
import type { PropsWithChildren } from 'react';

import { ProviderJotaiContextApprovalList } from '@onekeyhq/kit/src/states/jotai/contexts/approvalList/atoms';
import { jotaiContextStore } from '@onekeyhq/kit/src/states/jotai/utils/jotaiContextStore';
import { JotaiContextStoreMirrorTracker } from '@onekeyhq/kit/src/states/jotai/utils/JotaiContextStoreMirrorTracker';

export const HomeApprovalListProviderMirrorBase = memo(
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
        <ProviderJotaiContextApprovalList store={store}>
          {children}
        </ProviderJotaiContextApprovalList>
      </>
    );
  },
);
HomeApprovalListProviderMirrorBase.displayName =
  'HomeApprovalListProviderMirrorBase';
