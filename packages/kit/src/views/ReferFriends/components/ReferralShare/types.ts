import type { IReferralShareCopy } from './referralShareCopy';

export type IReferralShareData = {
  copy: IReferralShareCopy;
  inviteCode: string;
  inviteUrl: string;
  // The invite link without its scheme, as the invite card shows it.
  displayUrl: string;
};

export type IReferralShareImageGeneratorRef = {
  generate: () => Promise<string>;
};
