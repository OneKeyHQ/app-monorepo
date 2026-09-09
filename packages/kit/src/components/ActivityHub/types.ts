import type { IReferralShareSource } from '@onekeyhq/shared/src/config/appConfig';

export type IActivityHubCampaign = {
  id: string;
  imageUrl?: string;
  iconName?: string;
  title: string;
  subtitle: string;
  url: string;
};

export type IActivityHubSource = IReferralShareSource;
