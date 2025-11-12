import { useCallback } from 'react';

import { useInTabDialog } from '@onekeyhq/components';

import { showPositionShareDialog } from '../components/PositionShare/PositionShareModal';

import type { IShareData } from '../components/PositionShare/types';

export function useShowPositionShare() {
  const dialogInTab = useInTabDialog();

  const showShare = useCallback(
    (data: IShareData) => {
      showPositionShareDialog(data, dialogInTab);
    },
    [dialogInTab],
  );

  return { showPositionShare: showShare };
}
