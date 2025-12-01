import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useReferFriends } from '../../../hooks/useReferFriends';

export function GiftAction({ source = 'Earn' }: { source?: 'Earn' | 'Perps' }) {
  const { shareReferRewards } = useReferFriends();
  const handleShareReferRewards = useCallback(() => {
    void shareReferRewards(undefined, undefined, source);
  }, [shareReferRewards, source]);
  const intl = useIntl();
  return (
    <HeaderIconButton
      title={intl.formatMessage({ id: ETranslations.referral_title })}
      icon="GiftOutline"
      onPress={handleShareReferRewards}
    />
  );
}
