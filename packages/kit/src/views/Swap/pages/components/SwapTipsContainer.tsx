import { useIntl } from 'react-intl';

import { Alert, EPageType, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useSwapTipsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

interface ISwapTipsContainerProps {
  pageType?: EPageType;
}

const SWAP_TIPS_RESERVED_HEIGHT = platformEnv.isNative ? 56 : 58;

const SwapTipsContainer = ({ pageType }: ISwapTipsContainerProps) => {
  const [swapTipsState, setSwapTipsState] = useSwapTipsAtom();
  const intl = useIntl();
  // Don't show tips in modal
  if (pageType === EPageType.modal || swapTipsState.status === 'empty') {
    return null;
  }
  const swapTips = swapTipsState.tips;

  if (swapTipsState.status === 'unknown') {
    return <YStack h={SWAP_TIPS_RESERVED_HEIGHT} />;
  }

  if (!swapTips) {
    return null;
  }

  const handleClose = async () => {
    try {
      setSwapTipsState({
        status: 'empty',
        updatedAt: Date.now(),
      });
      await backgroundApiProxy.simpleDb.swapConfigs.setSwapUserCloseTips(
        swapTips.tipsId,
      );
    } catch (_error) {
      setSwapTipsState(swapTipsState);
    }
  };

  const action = swapTips.detailLink
    ? {
        primary: intl.formatMessage({ id: ETranslations.global_learn_more }),
        onPrimaryPress: () => openUrlExternal(swapTips.detailLink ?? ''),
      }
    : undefined;

  return (
    <YStack minHeight={SWAP_TIPS_RESERVED_HEIGHT}>
      <Alert
        type="info"
        fullBleed
        borderWidth={0}
        minHeight={SWAP_TIPS_RESERVED_HEIGHT}
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
