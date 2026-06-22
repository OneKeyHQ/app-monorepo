import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IActionListSection, IKeyOfIcons } from '@onekeyhq/components';
import { ActionList, Button, SizableText } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EReplaceTxType } from '@onekeyhq/shared/types/tx';

interface ISpeedUpActionProps {
  networkId: string;
  onSpeedUp: (params: { replaceType: EReplaceTxType }) => void;
  // Opt-in tighter styling for the tx detail status row (OK-56372 §6).
  // Off by default so the history list keeps its original look.
  compact?: boolean;
}

export function SpeedUpAction({
  networkId,
  onSpeedUp,
  compact = false,
}: ISpeedUpActionProps) {
  const intl = useIntl();

  // Button locks its font size to the `size` variant; render custom text via
  // `childrenAsText={false}` to get the compact `$bodySmMedium`.
  const compactButtonProps = compact
    ? ({ childrenAsText: false, px: '$3' } as const)
    : null;
  const speedUpLabel = intl.formatMessage({
    id: ETranslations.global_speed_up,
  });
  const renderSpeedUpLabel = compact ? (
    <SizableText size="$bodySmMedium" color="$textInverse">
      {speedUpLabel}
    </SizableText>
  ) : (
    speedUpLabel
  );

  const { useActionList, sections } = useMemo<{
    useActionList: boolean;
    sections: IActionListSection[];
  }>(() => {
    if (networkUtils.isBTCNetwork(networkId)) {
      return {
        useActionList: true,
        sections: [
          {
            items: [
              {
                label: 'RBF (coming soon)',
                icon: 'RepeatOutline' as IKeyOfIcons,
                disabled: true,
              },
            ],
          },
          {
            items: [
              {
                label: intl.formatMessage(
                  {
                    id: ETranslations.tx_accelerate_accelerator_selector_item_label,
                  },
                  {
                    name: 'F2Pool',
                  },
                ),
                icon: 'F2PoolSolid' as IKeyOfIcons,
                onPress: () => {
                  onSpeedUp({ replaceType: EReplaceTxType.SpeedUp });
                },
              },
            ],
          },
        ],
      };
    }

    return {
      useActionList: false,
      sections: [],
    };
  }, [networkId, onSpeedUp, intl]);

  if (useActionList) {
    return (
      <ActionList
        title={intl.formatMessage({ id: ETranslations.global_speed_up })}
        sections={sections}
        renderTrigger={
          <Button
            testID="tx-history-speed-up-btn"
            size="small"
            variant="primary"
            {...compactButtonProps}
          >
            {renderSpeedUpLabel}
          </Button>
        }
      />
    );
  }

  return (
    <Button
      testID="tx-history-speed-up-btn"
      size="small"
      variant="primary"
      onPress={() => onSpeedUp({ replaceType: EReplaceTxType.SpeedUp })}
      {...compactButtonProps}
    >
      {renderSpeedUpLabel}
    </Button>
  );
}
