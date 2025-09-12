import { type PropsWithChildren, memo } from 'react';

import { HomeApprovalListProviderMirrorBase } from './HomeApprovalListProviderMirrorBase';
import { useHomeApprovalListContextStoreInitData } from './HomeApprovalListRootProvider';

export const HomeApprovalListProviderMirror = memo(
  (props: PropsWithChildren) => {
    const data = useHomeApprovalListContextStoreInitData();
    return <HomeApprovalListProviderMirrorBase {...props} data={data} />;
  },
);
HomeApprovalListProviderMirror.displayName = 'HomeApprovalListProviderMirror';
