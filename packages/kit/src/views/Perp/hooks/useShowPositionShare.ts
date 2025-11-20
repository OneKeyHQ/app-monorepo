import { useCallback } from 'react';

import { useInPageDialog } from '@onekeyhq/components';

import { showPositionShareDialog } from '../components/PositionShare/PositionShareModal';

import type { IShareData } from '../components/PositionShare/types';

export function useShowPositionShare() {
  const dialog = useInPageDialog();

  const showShare = useCallback(
    (data: IShareData) => {
      showPositionShareDialog(data, dialog);
    },
    [dialog],
  );

  return { showPositionShare: showShare };
}
