import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { IButtonProps } from '@onekeyhq/components';
import { HeaderIconButton } from '@onekeyhq/components/src/layouts/Navigation/Header';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useReferFriends } from '../../../hooks/useReferFriends';

export function GiftAction({
  source = 'Earn',
  size = 'medium',
  copyAsUrl = false,
}: {
  source?: 'Earn' | 'Perps';
  size?: IButtonProps['size'];
  copyAsUrl?: boolean;
}) {
  const { shareReferRewards } = useReferFriends();
  const handleShareReferRewards = useCallback(() => {
    void shareReferRewards(undefined, undefined, source, copyAsUrl);
  }, [shareReferRewards, source, copyAsUrl]);
  const intl = useIntl();
  return (
    <HeaderIconButton
      title={intl.formatMessage({ id: ETranslations.referral_title })}
      icon="GiftOutline"
      size={size}
      onPress={handleShareReferRewards}
    />
  );
}
