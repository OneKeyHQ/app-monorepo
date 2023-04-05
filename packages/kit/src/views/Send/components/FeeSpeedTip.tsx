import { useIntl } from 'react-intl';

import { Icon, Tooltip } from '@onekeyhq/components';
import type { LocaleIds } from '@onekeyhq/components/src/locale';
import Pressable from '@onekeyhq/components/src/Pressable/Pressable';

export function FeeSpeedTip({
  index,
  isCustom,
}: {
  index?: number | string;
  isCustom?: boolean;
}) {
  const intl = useIntl();
  const indexInt = parseInt(index as string, 10);

  let feeSpeedTipId: LocaleIds;

  if (isCustom) {
    feeSpeedTipId = 'content__gas_option_custom_desc';
  } else {
    switch (indexInt) {
      case 0:
        feeSpeedTipId = 'content__gas_option_low_desc';
        break;
      case 1:
        feeSpeedTipId = 'content__gas_option_market_desc';
        break;
      case 2:
        feeSpeedTipId = 'content__gas_option_aggressive_desc';
        break;
      default:
        feeSpeedTipId = 'content__gas_option_market_desc';
    }
  }

  return (
    <Tooltip
      hasArrow
      maxW="260px"
      placement="top right"
      label={intl.formatMessage({
        id: feeSpeedTipId,
      })}
    >
      <Pressable>
        <Icon name="InformationCircleMini" size={18} color="icon-subdued" />
      </Pressable>
    </Tooltip>
  );
}
