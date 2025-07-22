import { useIntl } from 'react-intl';

import { Divider, SegmentControl, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ESwapNetworkFeeLevel } from '@onekeyhq/shared/types/swap/types';

import PreSwapInfoItem from './PreSwapInfoItem';

const PreSwapNetFeeSelectContent = () => {
  const intl = useIntl();
  return (
    <YStack gap="$3">
      <SegmentControl
        value={ESwapNetworkFeeLevel.LOW}
        options={[]}
        onChange={() => {}}
      />
      <Divider />
      <PreSwapInfoItem
        title={intl.formatMessage({
          id: ETranslations.fee_expected_fee,
        })}
        value="100"
      />
      <PreSwapInfoItem
        title={intl.formatMessage({
          id: ETranslations.fee_max_fee,
        })}
        value="100"
      />
    </YStack>
  );
};

export default PreSwapNetFeeSelectContent;
