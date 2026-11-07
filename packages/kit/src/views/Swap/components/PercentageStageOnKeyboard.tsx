import { useMemo } from 'react';

import { useIsKeyboardShown } from '@onekeyhq/components';
import { PercentageStageRow } from '@onekeyhq/kit/src/components/PercentageStageOnKeyboard/PercentageStageRow';
import { useInAppNotificationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { SwapPercentageInputStageForNative } from '@onekeyhq/shared/types/swap/types';

export function PercentageStageOnKeyboard({
  onSelectPercentageStage,
  stageList,
}: {
  onSelectPercentageStage?: (stage: number) => void;
  stageList?: number[];
}) {
  const isShow = useIsKeyboardShown();
  const [{ swapPercentageInputStageShowForNative }] =
    useInAppNotificationAtom();
  let viewShow = platformEnv.isNativeIOS;
  if (!platformEnv.isNativeIOS) {
    viewShow = isShow && swapPercentageInputStageShowForNative;
  }

  const stageListToShow = useMemo(() => {
    if (stageList && stageList.length > 0) {
      return stageList;
    }
    return SwapPercentageInputStageForNative;
  }, [stageList]);

  return viewShow ? (
    <PercentageStageRow
      onSelectPercentageStage={onSelectPercentageStage}
      stageList={stageListToShow}
    />
  ) : null;
}
