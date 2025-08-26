import { useIntl } from 'react-intl';

import { Alert } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSwapTipsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

const SwapTipsContainer = () => {
  const [swapTips] = useSwapTipsAtom();
  const intl = useIntl();
  if (!swapTips) {
    return null;
  }
  return (
    <Alert
      type="info"
      title={typeof swapTips.title === 'string' ? swapTips.title.trim() : ''}
      titleNumberOfLines={2}
      closable={swapTips.userCanClose}
      onClose={() => {
        void backgroundApiProxy.simpleDb.swapConfigs.setSwapUserCloseTips(
          swapTips.tipsId,
        );
      }}
      action={
        swapTips.detailLink
          ? {
              primary: intl.formatMessage({ id: ETranslations.global_details }),
              onPrimaryPress: () => {
                void openUrlExternal(swapTips.detailLink ?? '');
              },
            }
          : undefined
      }
    />
  );
};

export default SwapTipsContainer;
