import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { useInPageDialog } from '@onekeyhq/components';
import type { TPerpShareSource } from '@onekeyhq/shared/src/logger/scopes/perp/type';

import { showPositionShareDialog } from '../components/PositionShare/PositionShareModal';

import type { IShareData } from '../components/PositionShare/types';

export function useShowPositionShare() {
  const dialog = useInPageDialog();
  const intl = useIntl();

  const showShare = useCallback(
    (data: IShareData, source: TPerpShareSource) => {
      showPositionShareDialog(data, intl, source, dialog);
    },
    [dialog, intl],
  );

  return { showPositionShare: showShare };
}
