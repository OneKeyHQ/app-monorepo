import { useIntl } from 'react-intl';

import { Icon, SizableText, Tooltip } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

interface ICommunityRecognizedBadgeProps {
  size?: '$4' | '$5';
}

export function CommunityRecognizedBadge({
  size = '$4',
}: ICommunityRecognizedBadgeProps) {
  const intl = useIntl();

  return (
    <Tooltip
      placement="top"
      renderTrigger={
        <Icon name="BadgeRecognizedSolid" size={size} color="$iconSuccess" />
      }
      renderContent={
        <SizableText size="$bodySm">
          {intl.formatMessage({
            id: ETranslations.dexmarket_communityRecognized,
          })}
        </SizableText>
      }
    />
  );
}
