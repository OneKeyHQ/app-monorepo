import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  ScrollView,
  SizableText,
  Stack,
  YStack,
} from '@onekeyhq/components';
import type { IInputAddOnProps } from '@onekeyhq/components/src/forms/Input/InputAddOnItem';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { ETranslations } from '@onekeyhq/shared/src/locale/enum/translations';
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

  const intl = useIntl();

  return (
    <ScrollView h={250}>
      <YStack gap="$2">
        {!items?.length ? (
          <SizableText>
            {intl.formatMessage({ id: ETranslations.explore_no_history })}
          </SizableText>
        ) : (
          items?.map((item) => {
            if (!item?.value?.trim()) {
              return null;
            }
            return (
              <Button
                key={item.value}
                onPress={() => {
                  onChange?.(item.value);
                }}
                textEllipsis
              >
                {item.value || '   '}
              </Button>
            );
          })
        )}
      </YStack>
    </ScrollView>
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
        title: appLocale.intl.formatMessage({
          id: ETranslations.global_name_history,
        }),
        showConfirmButton: false,
        showCancelButton: false,
        disableDrag: true,
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
