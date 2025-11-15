import { useMedia } from '@onekeyhq/components';

import { ReferralCodeCardDesktop } from './components/ReferralCodeCardDesktop';
import { ReferralCodeCardMobile } from './components/ReferralCodeCardMobile';

import type { IReferralCodeCardProps } from './types';

export function ReferralCodeCard(props: IReferralCodeCardProps) {
  const { gtMd } = useMedia();

  if (gtMd) {
    return <ReferralCodeCardDesktop {...props} />;
  }

  return <ReferralCodeCardMobile {...props} />;
}
