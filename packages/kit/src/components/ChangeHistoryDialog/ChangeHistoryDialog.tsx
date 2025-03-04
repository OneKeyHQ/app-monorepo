import {
  Button,
  Dialog,
  SizableText,
  Stack,
  YStack,
} from '@onekeyhq/components';
import type { IInputAddOnProps } from '@onekeyhq/components/src/forms/Input/InputAddOnItem';
import type {
  EChangeHistoryContentType,
  EChangeHistoryEntityType,
} from '@onekeyhq/shared/src/types/changeHistory';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../hooks/usePromiseResult';

function ChangeHistoryDialogContent({
  changeHistoryInfo,
  onChange,
}: {
  changeHistoryInfo: {
    entityId: string;
    entityType: EChangeHistoryEntityType;
    contentType: EChangeHistoryContentType;
  };
  onChange?: (val: string) => void;
}) {
  const { result: items } = usePromiseResult(async () => {
    const historyItems =
      await backgroundApiProxy.simpleDb.changeHistory.getChangeHistory(
        changeHistoryInfo,
      );
    return historyItems;
  }, [changeHistoryInfo]);

  // TODO scrollable
  return (
    <YStack gap="$2">
      {!items?.length ? (
        <SizableText>No history found</SizableText>
      ) : (
        items?.map((item) => (
          <Button
            key={item.value}
            onPress={() => {
              onChange?.(item.value);
            }}
          >
            {item.value}
          </Button>
        ))
      )}
    </YStack>
  );
}

export function buildChangeHistoryInputAddon({
  changeHistoryInfo,
  onChange,
}: {
  changeHistoryInfo: {
    entityId: string;
    entityType: EChangeHistoryEntityType;
    contentType: EChangeHistoryContentType;
  };
  onChange?: (val: string) => void;
}): IInputAddOnProps {
  return {
    iconName: 'ClockTimeHistoryOutline',
    onPress: () => {
      const d = Dialog.show({
        title: 'Name history on this device',
        showConfirmButton: false,
        showCancelButton: false,
        renderContent: (
          <Stack>
            <ChangeHistoryDialogContent
              changeHistoryInfo={changeHistoryInfo}
              onChange={(t) => {
                onChange?.(t);
                void d.close();
              }}
            />
          </Stack>
        ),
      });
    },
  };
}
