import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Checkbox, Dialog } from '@onekeyhq/components';
import { formatApy } from '@onekeyhq/kit/src/views/Staking/components/utils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import earnUtils from '@onekeyhq/shared/src/utils/earnUtils';
import type { IStakeProtocolDetails } from '@onekeyhq/shared/types/staking';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';

import { useEarnEventActive } from './useEarnEventActive';

export function useFalconEventEndedDialog({
  eventEndTime,
  providerName,
  weeklyNetApyWithoutFee,
}: {
  eventEndTime?: number;
  providerName: string;
  weeklyNetApyWithoutFee?: string;
}): { showFalconEventEndedDialog: () => Promise<void> } {
  const intl = useIntl();
  const { isEventActive } = useEarnEventActive(eventEndTime);
  const { result: falconDepositDoNotShowAgain, run } = usePromiseResult(
    () => backgroundApiProxy.serviceStaking.getFalconDepositDoNotShowAgain(),
    [],
    {
      initResult: false,
    },
  );
  const showFalconEventEndedDialog = useCallback(
    async (): Promise<void> =>
      new Promise((resolve) => {
        const isFalconProvider = earnUtils.isFalconProvider({
          providerName,
        });

        if (!isFalconProvider || isEventActive || falconDepositDoNotShowAgain) {
          resolve();
          return;
        }

        Dialog.show({
          icon: 'InfoCircleOutline',
          title: intl.formatMessage(
            { id: ETranslations.earn_apy_change_title },
            {
              value: `${formatApy(weeklyNetApyWithoutFee ?? 0)}%`,
            },
          ),
          description: intl.formatMessage({
            id: ETranslations.earn_apy_change_desc,
          }),
          showConfirmButton: true,
          showCancelButton: true,

          onConfirmText: intl.formatMessage({
            id: ETranslations.global_confirm,
          }),
          onCancelText: intl.formatMessage({
            id: ETranslations.global_cancel,
          }),
          renderContent: (
            <Dialog.Form
              formProps={{
                defaultValues: { showAgain: false },
              }}
            >
              <Dialog.FormField name="showAgain">
                <Checkbox
                  label={intl.formatMessage({
                    id: ETranslations.earn_dont_show_again,
                  })}
                />
              </Dialog.FormField>
            </Dialog.Form>
          ),
          onConfirm: async (dialogInstance) => {
            const { showAgain } = dialogInstance.getForm()?.getValues() ?? {};
            if (showAgain) {
              await backgroundApiProxy.serviceStaking.setFalconDepositDoNotShowAgain();
              setTimeout(() => {
                void run();
              });
            }
            await dialogInstance.close();
            resolve();
          },
        });
      }),
    [
      providerName,
      isEventActive,
      falconDepositDoNotShowAgain,
      intl,
      weeklyNetApyWithoutFee,
      run,
    ],
  );

  return { showFalconEventEndedDialog };
}
