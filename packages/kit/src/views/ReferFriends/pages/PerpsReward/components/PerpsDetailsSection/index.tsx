import { useMedia } from '@onekeyhq/components';
import type {
  IPerpsInviteItem,
  IPerpsInvitesSortBy,
  IPerpsInvitesSortOrder,
} from '@onekeyhq/shared/src/referralCode/type';

import { PerpsDetailsSectionDesktop } from './PerpsDetailsSectionDesktop';
import { PerpsDetailsSectionMobile } from './PerpsDetailsSectionMobile';

type IRecordsTabValue = 'undistributed' | 'total';

export interface IPerpsDetailsSectionProps {
  records: IPerpsInviteItem[];
  activeTab: IRecordsTabValue;
  onTabChange: (tab: IRecordsTabValue) => void;
  undistributedCount: number;
  totalCount: number;
  hideZeroVolume: boolean;
  onHideZeroVolumeChange: (value: boolean) => void;
  sortBy: IPerpsInvitesSortBy;
  sortOrder: IPerpsInvitesSortOrder;
  onSort: (field: IPerpsInvitesSortBy) => void;
  isLoadingMore?: boolean;
  isTabLoading?: boolean;
  hasUserSorted?: boolean;
}

export function PerpsDetailsSection(props: IPerpsDetailsSectionProps) {
  const { md } = useMedia();

  if (md) {
    return <PerpsDetailsSectionMobile {...props} />;
  }

  return <PerpsDetailsSectionDesktop {...props} />;
}
