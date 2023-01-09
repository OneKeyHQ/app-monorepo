import type { ReactElement } from 'react';

import type { HomeRoutesParams } from '../../routes/types';

export enum AnnualReportModal {
  ShareModal = 'ShareModal',
}

export type AnnualReportModalParams = {
  [AnnualReportModal.ShareModal]: {
    page: ReactElement;
  };
};

export type PageProps = {
  params: HomeRoutesParams['AnnualReport'];
  selectedCardIndex?: number;
  onSelectedCardIndexChange?: (index: number) => void;
};
