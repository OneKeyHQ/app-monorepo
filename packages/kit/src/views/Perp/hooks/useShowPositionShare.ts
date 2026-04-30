import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { useInPageDialog } from '@onekeyhq/components';

import { showPositionShareDialog } from '../components/PositionShare/PositionShareModal';

import type { IShareData } from '../components/PositionShare/types';

export function useShowPositionShare() {
  const dialog = useInPageDialog();
  const intl = useIntl();

  const showShare = useCallback(
    (data: IShareData) => {
      showPositionShareDialog(data, intl, dialog);
    },
    [dialog, intl],
  );

  return { showPositionShare: showShare };
}
