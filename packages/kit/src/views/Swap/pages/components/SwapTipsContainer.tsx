import { useIntl } from 'react-intl';

import { Alert, EPageType, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSwapTipsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

interface ISwapTipsContainerProps {
  pageType?: EPageType;
}

const SwapTipsContainer = ({ pageType }: ISwapTipsContainerProps) => {
  const [swapTips, setSwapTips] = useSwapTipsAtom();
  const intl = useIntl();
  // Don't show tips in modal
  if (!swapTips || pageType === EPageType.modal) {
    return null;
  }

  const handleClose = async () => {
    try {
      setSwapTips(undefined);
      await backgroundApiProxy.simpleDb.swapConfigs.setSwapUserCloseTips(
        swapTips.tipsId,
      );
    } catch (_error) {
      setSwapTips(swapTips);
    }
  };

  const action = swapTips.detailLink
    ? {
        primary: intl.formatMessage({ id: ETranslations.global_learn_more }),
        onPrimaryPress: () => openUrlExternal(swapTips.detailLink ?? ''),
      }
    : undefined;

  return (
    <YStack>
      <Alert
        type="info"
        fullBleed
        borderWidth={0}
        icon="InfoCircleSolid"
        title={swapTips.title}
        description={swapTips.description}
        action={action}
        closable={!!swapTips.userCanClose}
        onClose={handleClose}
      />
    </YStack>
  );
};

export default SwapTipsContainer;
