import type { PropsWithChildren } from 'react';

import { Page } from '@onekeyhq/components';
import { EDAppModalPageStatus } from '@onekeyhq/shared/types/dappConnection';

import type useDappApproveAction from '../../../hooks/useDappApproveAction';

type IProps = PropsWithChildren<{
  dappApprove: ReturnType<typeof useDappApproveAction>;
  onClose?: (extra?: { flag?: string }) => void;
}>;

export function useDappCloseHandler(
  dappApprove: ReturnType<typeof useDappApproveAction>,
  onClose?: (extra?: { flag?: string }) => void,
) {
  const handleOnClose = (extra?: { flag?: string }) => {
    if (extra?.flag !== EDAppModalPageStatus.Confirmed) {
      dappApprove.reject();
    }
    if (typeof onClose === 'function') {
      onClose(extra);
    }
  };

  return handleOnClose;
}

function DappOpenModalPage({ children, onClose, dappApprove }: IProps) {
  const handleOnClose = useDappCloseHandler(dappApprove, onClose);

  return (
    <Page scrollEnabled onClose={handleOnClose}>
      <Page.Header headerShown={false} />
      {children}
    </Page>
  );
}

export default DappOpenModalPage;
