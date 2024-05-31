import type { PropsWithChildren } from 'react';

import { Page } from '@onekeyhq/components';

import type useDappApproveAction from '../../../hooks/useDappApproveAction';

type IProps = PropsWithChildren<{
  dappApprove: ReturnType<typeof useDappApproveAction>;
  onClose?: (confirmed: boolean) => void;
}>;

function DappOpenModalPage({ children, onClose, dappApprove }: IProps) {
  const handleOnClose = (confirmed: boolean) => {
    if (!confirmed) {
      dappApprove.reject();
    }
    if (typeof onClose === 'function') {
      onClose(confirmed);
    }
  };

  return (
    <Page scrollEnabled onClose={handleOnClose}>
      <Page.Header headerShown={false} />
      {children}
    </Page>
  );
}

export default DappOpenModalPage;
