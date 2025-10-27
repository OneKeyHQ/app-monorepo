import { useCallback } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { IconButton, SizableText, XStack } from '@onekeyhq/components';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import type { IHasId, LinkedDeck } from '@onekeyhq/kit/src/hooks/useLinkedList';
import {
  useSendTxStatusAtom,
  useSignatureConfirmActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/signatureConfirm';
import { ETranslations } from '@onekeyhq/shared/src/locale';

type IProps<T> = {
  taskQueue: LinkedDeck<T & IHasId> | undefined;
};
function TaskQueueController<T>(props: IProps<T>) {
  const { taskQueue } = props;
  const intl = useIntl();
  const { updateUnsignedTxs } = useSignatureConfirmActions().current;

  const [sendTxStatus] = useSendTxStatusAtom();

  const handleChangeActiveTask = useCallback(
    (direction: 'prev' | 'next') => {
      if (!taskQueue) {
        return;
      }

      if (direction === 'prev') {
        taskQueue.prev();
      } else {
        taskQueue.next();
      }

      if (taskQueue.current) {
        updateUnsignedTxs([taskQueue.current as unknown as IUnsignedTxPro]);
      }
    },
    [taskQueue, updateUnsignedTxs],
  );

  if (!taskQueue) {
    return null;
  }

  return (
    <XStack
      alignItems="center"
      justifyContent="space-between"
      w="full"
      px="$5"
      py="$3.5"
      mx="$-5"
      borderTopWidth={StyleSheet.hairlineWidth}
      borderBottomWidth={StyleSheet.hairlineWidth}
      borderColor="$borderSubdued"
      backgroundColor="$bgSubdued"
      mb="$4"
    >
      <IconButton
        icon="ChevronLeftSmallSolid"
        size="medium"
        variant="tertiary"
        onPress={() => handleChangeActiveTask('prev')}
        disabled={
          !taskQueue.head ||
          taskQueue.current?.uuid === taskQueue.head.uuid ||
          sendTxStatus.isSubmitting
        }
      />
      <SizableText size="$bodyMdMedium">
        {intl.formatMessage(
          {
            id: ETranslations.global_current_of_total_confirmations,
          },
          {
            current: taskQueue.currentIndex + 1,
            total: taskQueue.size,
          },
        )}
      </SizableText>
      <IconButton
        icon="ChevronRightSmallSolid"
        size="medium"
        variant="tertiary"
        onPress={() => handleChangeActiveTask('next')}
        disabled={
          !taskQueue.tail ||
          taskQueue.current?.uuid === taskQueue.tail.uuid ||
          sendTxStatus.isSubmitting
        }
      />
    </XStack>
  );
}

export default TaskQueueController;
