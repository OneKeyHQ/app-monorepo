import { useIntl } from 'react-intl';

import { Alert, EPageType, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  useSwapTipsAtom,
  useSwapTypeSwitchAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { SwapTestIDs } from '../../testIDs';

import { shouldShowSwapTips } from './SwapTipsContainer.utils';

interface ISwapTipsContainerProps {
  pageType?: EPageType;
}

const SwapTipsContainer = ({ pageType }: ISwapTipsContainerProps) => {
  const [swapTipsState, setSwapTipsState] = useSwapTipsAtom();
  const [swapTypeSwitch] = useSwapTypeSwitchAtom();
  const intl = useIntl();
  // Don't show tips in modal
  if (pageType === EPageType.modal || swapTipsState.status !== 'ready') {
    return null;
  }
  const swapTips = swapTipsState.tips;

  if (!swapTips) {
    return null;
  }
  const shouldShowTips = shouldShowSwapTips({
    effectiveTab: swapTips.effectiveTab,
    swapType: swapTypeSwitch,
  });
  if (!shouldShowTips && (platformEnv.isNative || platformEnv.isWebMobile)) {
    return null;
  }

  const handleClose = async () => {
    const optimisticUpdatedAt = Date.now();
    try {
      setSwapTipsState({
        status: 'empty',
        updatedAt: optimisticUpdatedAt,
      });
      await backgroundApiProxy.simpleDb.swapConfigs.setSwapUserCloseTips(
        swapTips.tipsId,
      );
    } catch (_error) {
      setSwapTipsState((current) =>
        current.status === 'empty' && current.updatedAt === optimisticUpdatedAt
          ? {
              ...swapTipsState,
              updatedAt: Math.max(
                Date.now(),
                optimisticUpdatedAt + 1,
                swapTipsState.updatedAt + 1,
              ),
            }
          : current,
      );
    }
  };

  const action = swapTips.detailLink
    ? {
        primary: intl.formatMessage({ id: ETranslations.global_learn_more }),
        onPrimaryPress: () => openUrlExternal(swapTips.detailLink ?? ''),
      }
    : undefined;

  // On desktop, non-mobile web, and extension, keep the real Alert in layout
  // so inactive tabs reserve the active tab's exact height.
  return (
    <YStack
      testID={SwapTestIDs.tipsContainer}
      opacity={shouldShowTips ? 1 : 0}
      pointerEvents={shouldShowTips ? 'auto' : 'none'}
      aria-hidden={!shouldShowTips}
      accessibilityElementsHidden={!shouldShowTips}
      importantForAccessibility={
        shouldShowTips ? 'auto' : 'no-hide-descendants'
      }
      {...(platformEnv.isNative ? {} : { inert: !shouldShowTips })}
    >
      <Alert
        key={swapTipsState.updatedAt}
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
