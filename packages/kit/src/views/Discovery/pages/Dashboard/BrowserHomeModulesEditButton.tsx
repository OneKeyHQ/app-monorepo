import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import type {
  IDialogInstance,
  IDragEndParamsWithItem,
} from '@onekeyhq/components';
import {
  Button,
  Dialog,
  ESwitchSize,
  SortableListView,
  Stack,
  Switch,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { IBrowserHomeModuleConfig } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  getBrowserHomeModuleLabel,
  normalizeBrowserHomeModules,
} from './browserHomeModuleUtils';

const CELL_HEIGHT = 56;
const EDIT_DIALOG_CONTENT_PADDING_BOTTOM = 16;
const EDIT_DIALOG_HEIGHT = CELL_HEIGHT * 4 + EDIT_DIALOG_CONTENT_PADDING_BOTTOM;

const getBrowserHomeModuleItemLayout = (_: unknown, index: number) => ({
  length: CELL_HEIGHT,
  offset: index * CELL_HEIGHT,
  index,
});

function BrowserHomeModulesEditDialogContent() {
  const intl = useIntl();
  const [{ browserHomeModules }, setSettingsPersist] = useSettingsPersistAtom();

  const modules = useMemo(
    () => normalizeBrowserHomeModules(browserHomeModules),
    [browserHomeModules],
  );

  const persistModules = useCallback(
    (nextModules: IBrowserHomeModuleConfig[]) => {
      setSettingsPersist((settings) => ({
        ...settings,
        browserHomeModules: normalizeBrowserHomeModules(nextModules),
      }));
    },
    [setSettingsPersist],
  );

  const handleToggle = useCallback(
    (target: IBrowserHomeModuleConfig, visible: boolean) => {
      persistModules(
        modules.map((module) =>
          module.id === target.id ? { ...module, visible } : module,
        ),
      );
    },
    [modules, persistModules],
  );

  const handleDragEnd = useCallback(
    (params: IDragEndParamsWithItem<IBrowserHomeModuleConfig>) => {
      persistModules(params.data);
    },
    [persistModules],
  );

  return (
    <Stack h={EDIT_DIALOG_HEIGHT}>
      <SortableListView
        data={modules}
        enabled
        keyExtractor={(item) => item.id}
        getItemLayout={getBrowserHomeModuleItemLayout}
        contentContainerStyle={{
          paddingBottom: EDIT_DIALOG_CONTENT_PADDING_BOTTOM,
        }}
        onDragEnd={handleDragEnd}
        renderItem={({ item, drag, dragProps, isActive }) => (
          <ListItem
            h={CELL_HEIGHT}
            minHeight={0}
            px="$0"
            mx="$0"
            py="$0"
            gap="$2"
            borderRadius="$0"
            opacity={isActive ? 0.8 : 1}
          >
            <ListItem.Text
              primary={getBrowserHomeModuleLabel(intl, item.id)}
              primaryTextProps={{
                numberOfLines: 1,
              }}
              flex={1}
            />
            <Stack
              width="$16"
              height={CELL_HEIGHT}
              alignItems="center"
              justifyContent="center"
              flexShrink={0}
            >
              <Switch
                size={ESwitchSize.small}
                value={item.visible}
                onChange={(visible) => {
                  handleToggle(item, visible);
                }}
              />
            </Stack>
            <ListItem.IconButton
              key="drag"
              cursor="move"
              icon="DragOutline"
              onPressIn={drag}
              dataSet={dragProps}
            />
          </ListItem>
        )}
      />
    </Stack>
  );
}

export function BrowserHomeModulesEditButton() {
  const intl = useIntl();
  const dialogRef = useRef<IDialogInstance | null>(null);

  const handlePress = useCallback(() => {
    if (dialogRef.current?.isExist()) {
      return;
    }

    dialogRef.current = Dialog.show({
      title: intl.formatMessage({
        id: ETranslations.global_edit,
      }),
      renderContent: <BrowserHomeModulesEditDialogContent />,
      estimatedContentHeight: EDIT_DIALOG_HEIGHT,
      disableDrag: true,
      showFooter: false,
    });
  }, [intl]);

  useEffect(
    () => () => {
      if (dialogRef.current?.isExist()) {
        void dialogRef.current.close();
      }
      dialogRef.current = null;
    },
    [],
  );

  if (!platformEnv.isNative) {
    return null;
  }

  return (
    <Stack px="$pagePadding" width="100%" mt="$6" alignItems="center">
      <Button size="small" variant="secondary" onPress={handlePress}>
        {intl.formatMessage({ id: ETranslations.global_edit })}
      </Button>
    </Stack>
  );
}
