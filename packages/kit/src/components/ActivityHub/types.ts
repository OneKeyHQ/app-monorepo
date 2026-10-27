import type { IReferralShareSource } from '@onekeyhq/shared/src/config/appConfig';
import type { IReferralPageTab } from '@onekeyhq/shared/src/routes';

export type IActivityHubCampaign = {
  id: string;
  imageUrl?: string;
  iconName?: string;
  title: string;
  subtitle: string;
  url: string;
};

export type IActivityHubSource = IReferralShareSource;

// Opens the referral page; without a tab it reopens the one used last.
export type IActivityHubOpenReferral = (tab?: IReferralPageTab) => void;
