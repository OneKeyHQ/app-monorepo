export interface IReferralCodeCardProps {
  inviteUrl: string;
  inviteCode: string;
}

export interface IUseReferralCodeCardReturn {
  handleCopy: () => void;
  copyLink: () => void;
  inviteCodeUrl: string;
  handleShare: () => void;
  intl: {
    yourCode: string;
    referred: string;
    copy: string;
    share: string;
    referralCode: string;
    referralLink: string;
  };
}
