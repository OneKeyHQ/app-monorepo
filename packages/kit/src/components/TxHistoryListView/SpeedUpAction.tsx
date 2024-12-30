import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import type { IActionListSection, IKeyOfIcons } from '@onekeyhq/components';
import { ActionList, Button } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EReplaceTxType } from '@onekeyhq/shared/types/tx';

interface ISpeedUpActionProps {
  networkId: string;
  onSpeedUp: (params: { replaceType: EReplaceTxType }) => void;
}

export function SpeedUpAction({ networkId, onSpeedUp }: ISpeedUpActionProps) {
  const intl = useIntl();

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
                label: 'f2pool',
                icon: 'RepeatOutline' as IKeyOfIcons,
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
  }, [networkId, onSpeedUp]);

  if (useActionList) {
    return (
      <ActionList
        title="Speed up"
        sections={sections}
        renderTrigger={
          <Button size="small" variant="primary">
            {intl.formatMessage({ id: ETranslations.global_speed_up })}
          </Button>
        }
      />
    );
  }

  return (
    <Button
      size="small"
      variant="primary"
      onPress={() => onSpeedUp({ replaceType: EReplaceTxType.SpeedUp })}
    >
      {intl.formatMessage({ id: ETranslations.global_speed_up })}
    </Button>
  );
}
