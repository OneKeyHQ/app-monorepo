import { memo } from 'react';

import { useIntl } from 'react-intl';

import { Badge, Icon } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

type IProps = {
  onPress?: () => void;
};

function CoinControlBadge({ onPress }: IProps) {
  const intl = useIntl();
  return (
    <Badge
      userSelect="none"
      role="button"
      gap="$0.5"
      hoverStyle={{ bg: '$bgStrongHover' }}
      onPress={onPress}
      $platform-native={{
        hitSlop: {
          top: 8,
          bottom: 8,
          left: 8,
          right: 8,
        },
      }}
      focusVisibleStyle={{
        outlineWidth: 2,
        outlineColor: '$focusRing',
        outlineStyle: 'solid',
        outlineOffset: 0,
      }}
    >
      <Badge.Text>
        {intl.formatMessage({ id: ETranslations.wallet_coin_control })}
      </Badge.Text>
      <Icon name="ExpandOutline" size="$4" color="$icon" />
    </Badge>
  );
}

export default memo(CoinControlBadge);
