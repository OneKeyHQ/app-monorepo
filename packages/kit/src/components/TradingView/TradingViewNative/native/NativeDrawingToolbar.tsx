import { useContext, useMemo, useState } from 'react';

import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { SvgXml } from 'react-native-svg';

import {
  Button,
  HeaderScrollGestureContext,
  Input,
  ScrollGuard,
  ScrollGuardDirection,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import type { IScrollViewProps } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { TRADING_VIEW_DRAWING_ICONS } from '../drawings/icons';
import {
  DEFAULT_DRAWING_FONT_SIZE,
  DRAWING_FONT_SIZES,
  DRAWING_TOOLS,
  isFreehandTool,
  isTextDrawingTool,
} from '../drawings/model';

import type { IDrawingTool } from '../drawings/model';
import type { IChartDrawingsController } from '../drawings/useChartDrawings';

type IIconName = keyof typeof TRADING_VIEW_DRAWING_ICONS;
function DrawingScrollView(props: IScrollViewProps) {
  const headerScrollGestures = useContext(HeaderScrollGestureContext);
  const scrollGesture = useMemo(
    () =>
      Gesture.Native()
        .shouldCancelWhenOutside(false)
        .disallowInterruption(true)
        .blocksExternalGesture(...headerScrollGestures),
    [headerScrollGestures],
  );
  const scrollView = (
    <GestureDetector gesture={scrollGesture}>
      <ScrollView flex={1} {...props} />
    </GestureDetector>
  );
  // Android's ancestor native ScrollView can intercept before RNGH activates.
  return platformEnv.isNativeAndroid ? (
    <ScrollGuard direction={ScrollGuardDirection.VERTICAL} style={{ flex: 1 }}>
      {scrollView}
    </ScrollGuard>
  ) : (
    scrollView
  );
}

function DrawingIcon({ name, active }: { name: IIconName; active?: boolean }) {
  const theme = useTheme();
  return (
    <SvgXml
      xml={TRADING_VIEW_DRAWING_ICONS[name]}
      width={name === 'chevron' ? 8 : 26}
      height={name === 'chevron' ? 14 : 26}
      color={active ? '#2962ff' : theme.text.val}
    />
  );
}
function DrawingButton({
  icon,
  label,
  testID,
  active,
  disabled,
  onPress,
}: {
  icon: IIconName;
  label: string;
  testID: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Stack
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      width={40}
      minHeight={40}
      alignItems="center"
      justifyContent="center"
      borderRadius="$2"
      bg={active ? '$bgActive' : undefined}
      opacity={disabled ? 0.3 : 1}
      onPress={disabled ? undefined : onPress}
    >
      <DrawingIcon name={icon} active={active} />
    </Stack>
  );
}

function EditField({
  label,
  value,
  onSave,
  disabled,
  testID,
  multiline = false,
}: {
  label: string;
  value: string;
  onSave: (value: string) => void;
  disabled: boolean;
  testID: string;
  multiline?: boolean;
}) {
  const [text, setText] = useState(value);
  return (
    <YStack gap="$1">
      <SizableText size="$bodySm" color="$textSubdued">
        {label}
      </SizableText>
      <Input
        testID={testID}
        accessibilityLabel={label}
        value={text}
        onChangeText={setText}
        disabled={disabled}
        multiline={multiline}
        maxLength={multiline ? 500 : undefined}
        minHeight={multiline ? 96 : undefined}
        textAlignVertical={multiline ? 'top' : undefined}
        autoCorrect={false}
        autoCapitalize="none"
        onEndEditing={() => {
          if (text !== value) onSave(text);
        }}
      />
    </YStack>
  );
}

export function NativeDrawingToolbar({
  controller,
}: {
  controller: IChartDrawingsController;
}) {
  const { state } = controller;
  const [collapsed, setCollapsed] = useState(false);
  const [group, setGroup] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  const selected = state.history.present.find(
    (drawing) => drawing.id === state.selectedId,
  );
  const selectedIndex = state.history.present.findIndex(
    (drawing) => drawing.id === state.selectedId,
  );
  const style = selected ?? state.style;
  const activeTool = selected?.tool ?? state.tool;
  const hasText = isTextDrawingTool(activeTool);
  const hasLine = activeTool !== 'text' && activeTool !== 'priceLabel';
  const disabled =
    !state.ready || Boolean(selected && (selected.locked || state.locked));
  const groups = [
    ...new Set(Object.values(DRAWING_TOOLS).map((tool) => tool.group)),
  ];
  const open = Boolean(group || state.panel || settings);
  const close = () => {
    setGroup(null);
    setSettings(false);
    if (state.panel) controller.togglePanel(state.panel);
  };
  let panelTitle = state.panel === 'objects' ? 'Object Tree' : 'Data Window';
  if (settings) panelTitle = 'Drawing settings';
  if (group) panelTitle = group;
  const data = state.data;
  const date = data ? new Date(data.time * 1000).toISOString() : null;
  return (
    <>
      <YStack
        width={collapsed ? 24 : 42}
        minHeight={0}
        bg="$bgApp"
        borderRightWidth={1}
        borderColor="$borderSubdued"
        testID="native-drawing-toolbar"
      >
        {!collapsed ? (
          <DrawingScrollView
            testID="native-drawing-toolbar-scroll"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ alignItems: 'center' }}
          >
            <DrawingButton
              icon="cursor"
              label="Cursor"
              testID="native-drawing-cursor"
              active={state.tool === 'cursor'}
              onPress={() => {
                controller.selectTool('cursor');
                close();
              }}
            />
            {groups.map((name) => {
              const tool =
                (Object.keys(DRAWING_TOOLS) as IDrawingTool[]).find(
                  (key) => DRAWING_TOOLS[key].group === name,
                ) ?? 'trend';
              return (
                <DrawingButton
                  key={name}
                  icon={tool}
                  label={name}
                  testID={`native-drawing-group-${name}`}
                  active={
                    state.tool !== 'cursor' &&
                    DRAWING_TOOLS[state.tool].group === name
                  }
                  disabled={!state.ready}
                  onPress={() => {
                    close();
                    setGroup(name);
                  }}
                />
              );
            })}
            <DrawingButton
              icon="objects"
              label="Object Tree"
              testID="native-drawing-objects"
              active={state.panel === 'objects'}
              onPress={() => {
                setGroup(null);
                setSettings(false);
                controller.togglePanel('objects');
              }}
            />
            <DrawingButton
              icon="data"
              label="Data Window"
              testID="native-drawing-data"
              active={state.panel === 'data'}
              onPress={() => {
                setGroup(null);
                setSettings(false);
                controller.togglePanel('data');
              }}
            />
            <DrawingButton
              icon="magnet"
              label="Magnet"
              testID="native-drawing-magnet"
              active={state.magnet}
              onPress={() => controller.toggle('magnet')}
            />
            <DrawingButton
              icon="stay"
              label="Stay in drawing mode"
              testID="native-drawing-stay"
              active={state.stayInDrawingMode}
              onPress={() => controller.toggle('stayInDrawingMode')}
            />
            <DrawingButton
              icon={state.locked ? 'lock' : 'unlock'}
              label="Lock all drawings"
              testID="native-drawing-lock-all"
              active={state.locked}
              onPress={() => controller.toggle('locked')}
            />
            <DrawingButton
              icon={state.hidden ? 'show' : 'hide'}
              label="Hide drawings"
              testID="native-drawing-hide-all"
              active={state.hidden}
              onPress={() => controller.toggle('hidden')}
            />
            <DrawingButton
              icon="undo"
              label="Undo"
              testID="native-drawing-undo"
              disabled={!state.history.past.length}
              onPress={() => controller.historyAction('undo')}
            />
            <DrawingButton
              icon="redo"
              label="Redo"
              testID="native-drawing-redo"
              disabled={!state.history.future.length}
              onPress={() => controller.historyAction('redo')}
            />
            <DrawingButton
              icon="delete"
              label="Remove unlocked drawings"
              testID="native-drawing-clear"
              disabled={
                state.locked ||
                !state.history.present.some((drawing) => !drawing.locked)
              }
              onPress={controller.clear}
            />
          </DrawingScrollView>
        ) : (
          <Stack flex={1} />
        )}
        <Stack
          testID="native-drawing-collapse"
          accessibilityRole="button"
          accessibilityLabel={
            collapsed ? 'Expand drawing toolbar' : 'Collapse drawing toolbar'
          }
          alignItems="center"
          justifyContent="center"
          height={40}
          onPress={() => {
            setCollapsed(!collapsed);
            close();
          }}
        >
          <Stack rotate={collapsed ? '0deg' : '180deg'}>
            <DrawingIcon name="chevron" />
          </Stack>
        </Stack>
      </YStack>
      {!open && (selected || state.tool !== 'cursor') && !state.hidden ? (
        <XStack
          position="absolute"
          top={4}
          left={collapsed ? 28 : 46}
          right={4}
          zIndex={5}
          bg="$bgApp"
          borderWidth={1}
          borderColor="$borderSubdued"
          borderRadius="$2"
          alignItems="center"
          px="$1"
        >
          <Button
            testID="native-drawing-settings"
            size="small"
            variant="tertiary"
            flex={1}
            onPress={() => setSettings(true)}
          >
            Settings
          </Button>
          {selected ? (
            <>
              <DrawingButton
                icon={selected.locked ? 'lock' : 'unlock'}
                label={selected.locked ? 'Unlock drawing' : 'Lock drawing'}
                testID="native-drawing-lock"
                active={selected.locked}
                disabled={state.locked}
                onPress={controller.toggleSelectedLock}
              />
              <DrawingButton
                icon="delete"
                label="Delete drawing"
                testID="native-drawing-delete"
                disabled={disabled}
                onPress={controller.removeSelected}
              />
            </>
          ) : null}
          <Button
            testID="native-drawing-done"
            size="small"
            variant="tertiary"
            onPress={() => controller.selectTool('cursor')}
          >
            Done
          </Button>
        </XStack>
      ) : null}
      {open ? (
        <YStack
          position="absolute"
          top={!group && !settings && state.panel === 'data' ? '50%' : 4}
          left={collapsed ? 28 : 46}
          right={4}
          bottom={4}
          zIndex={10}
          bg="$bgApp"
          borderWidth={1}
          borderColor="$borderSubdued"
          borderRadius="$3"
          testID="native-drawing-panel"
        >
          <XStack
            alignItems="center"
            justifyContent="space-between"
            px="$3"
            minHeight={44}
            borderBottomWidth={1}
            borderColor="$borderSubdued"
          >
            <SizableText size="$bodyMdMedium">{panelTitle}</SizableText>
            <Button
              testID="native-drawing-panel-close"
              size="small"
              variant="tertiary"
              onPress={close}
            >
              Done
            </Button>
          </XStack>
          <DrawingScrollView
            testID="native-drawing-panel-scroll"
            keyboardShouldPersistTaps="handled"
          >
            {group ? (
              <YStack p="$2">
                {(Object.keys(DRAWING_TOOLS) as IDrawingTool[])
                  .filter((tool) => DRAWING_TOOLS[tool].group === group)
                  .map((tool) => (
                    <XStack
                      key={tool}
                      testID={`native-drawing-tool-${tool}`}
                      accessibilityRole="button"
                      accessibilityLabel={DRAWING_TOOLS[tool].label}
                      accessibilityState={{ selected: state.tool === tool }}
                      minHeight={44}
                      px="$2"
                      gap="$3"
                      alignItems="center"
                      bg={state.tool === tool ? '$bgActive' : undefined}
                      onPress={() => {
                        controller.selectTool(tool);
                        setGroup(null);
                      }}
                    >
                      <DrawingIcon name={tool} active={state.tool === tool} />
                      <SizableText size="$bodyMd">
                        {DRAWING_TOOLS[tool].label}
                      </SizableText>
                    </XStack>
                  ))}
              </YStack>
            ) : null}
            {!group && !settings && state.panel === 'objects' ? (
              <YStack p="$2" gap="$1">
                {[...state.history.present].toReversed().map((drawing) => (
                  <XStack
                    key={drawing.id}
                    alignItems="center"
                    bg={
                      state.selectedIds.includes(drawing.id)
                        ? '$bgActive'
                        : undefined
                    }
                  >
                    <XStack
                      testID={`native-drawing-object-${drawing.id}`}
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${drawing.name ?? DRAWING_TOOLS[drawing.tool].label}`}
                      flex={1}
                      minWidth={0}
                      minHeight={44}
                      gap="$2"
                      alignItems="center"
                      onPress={() => controller.selectDrawing(drawing.id)}
                    >
                      <DrawingIcon name={drawing.tool} />
                      <SizableText
                        numberOfLines={1}
                        size="$bodySm"
                        flex={1}
                        opacity={drawing.hidden ? 0.5 : 1}
                      >
                        {drawing.name || DRAWING_TOOLS[drawing.tool].label}
                      </SizableText>
                    </XStack>
                    <DrawingButton
                      icon={drawing.hidden ? 'show' : 'hide'}
                      label="Toggle visibility"
                      testID={`native-drawing-visibility-${drawing.id}`}
                      onPress={() =>
                        controller.updateDrawing(drawing.id, {
                          hidden: !drawing.hidden,
                        })
                      }
                    />
                    <DrawingButton
                      icon={drawing.locked ? 'lock' : 'unlock'}
                      label="Toggle lock"
                      testID={`native-drawing-lock-${drawing.id}`}
                      disabled={state.locked}
                      onPress={() =>
                        controller.updateDrawing(drawing.id, {
                          locked: !drawing.locked,
                        })
                      }
                    />
                  </XStack>
                ))}
                {!state.history.present.length ? (
                  <SizableText p="$3" size="$bodySm" color="$textSubdued">
                    Drawings on this chart will appear here.
                  </SizableText>
                ) : null}
                {selected ? (
                  <YStack p="$2" gap="$2">
                    <EditField
                      key={`${selected.id}-name`}
                      label="Name"
                      value={
                        selected.name ?? DRAWING_TOOLS[selected.tool].label
                      }
                      testID="native-drawing-object-name"
                      disabled={disabled}
                      onSave={(name) =>
                        controller.updateDrawing(selected.id, {
                          name: name.slice(0, 100),
                        })
                      }
                    />
                    <XStack gap="$2">
                      <Button
                        testID="native-drawing-forward"
                        size="small"
                        flex={1}
                        disabled={
                          disabled ||
                          selectedIndex === state.history.present.length - 1
                        }
                        onPress={() =>
                          controller.reorderDrawing(selected.id, 1)
                        }
                      >
                        Forward
                      </Button>
                      <Button
                        testID="native-drawing-backward"
                        size="small"
                        flex={1}
                        disabled={disabled || selectedIndex === 0}
                        onPress={() =>
                          controller.reorderDrawing(selected.id, -1)
                        }
                      >
                        Backward
                      </Button>
                    </XStack>
                    <XStack gap="$2">
                      <Button
                        testID="native-drawing-object-edit"
                        size="small"
                        flex={1}
                        onPress={() => {
                          controller.togglePanel('objects');
                          setSettings(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        testID="native-drawing-object-delete"
                        size="small"
                        flex={1}
                        disabled={disabled}
                        onPress={controller.removeSelected}
                      >
                        Delete
                      </Button>
                    </XStack>
                  </YStack>
                ) : null}
              </YStack>
            ) : null}
            {!group && !settings && state.panel === 'data' ? (
              <YStack p="$3" gap="$3">
                <SizableText size="$bodySm" color="$textSubdued">
                  {date
                    ? `${date.slice(0, 10)} ${date.slice(11, 19)} UTC`
                    : 'Waiting for chart data…'}
                </SizableText>
                {data?.groups.map((section, index) => (
                  <YStack key={`${section.name}-${index}`} gap="$1">
                    <SizableText size="$bodySmMedium">
                      {section.name}
                    </SizableText>
                    {section.rows.map((row) => (
                      <XStack
                        key={row.name}
                        justifyContent="space-between"
                        gap="$2"
                      >
                        <SizableText size="$bodySm" color="$textSubdued">
                          {row.name}
                        </SizableText>
                        <SizableText
                          testID={`native-drawing-data-${row.name}`}
                          size="$bodySm"
                        >
                          {row.value !== null && Number.isFinite(row.value)
                            ? Number(row.value.toPrecision(10)).toString()
                            : '—'}
                        </SizableText>
                      </XStack>
                    ))}
                  </YStack>
                ))}
              </YStack>
            ) : null}
            {settings ? (
              <YStack p="$3" gap="$3">
                {selected &&
                (selected.tool === 'text' || selected.tool === 'callout') ? (
                  <EditField
                    key={`${selected.id}-text-${selected.text ?? ''}`}
                    label="Content"
                    value={selected.text ?? 'Text'}
                    testID="native-drawing-text"
                    disabled={disabled}
                    multiline
                    onSave={(text) =>
                      controller.changeStyle({ text: text.slice(0, 500) })
                    }
                  />
                ) : null}
                <SizableText size="$bodySmMedium">
                  {hasText ? 'Text color' : 'Color'}
                </SizableText>
                <XStack flexWrap="wrap" gap="$2">
                  {[
                    '#2962FF',
                    '#F23645',
                    '#089981',
                    '#FF9800',
                    '#9C27B0',
                    '#787B86',
                    '#000000',
                    '#FFFFFF',
                  ].map((color) => (
                    <Stack
                      key={color}
                      testID={`native-drawing-color-${color.slice(1)}`}
                      accessibilityRole="button"
                      accessibilityLabel={color}
                      width={32}
                      height={32}
                      borderRadius="$2"
                      bg={color}
                      borderWidth={style.color === color ? 3 : 1}
                      borderColor="$borderStrong"
                      opacity={disabled ? 0.3 : 1}
                      onPress={
                        disabled
                          ? undefined
                          : () => controller.changeStyle({ color })
                      }
                    />
                  ))}
                </XStack>
                {hasText ? (
                  <>
                    <SizableText size="$bodySmMedium">Font size</SizableText>
                    <XStack gap="$2" flexWrap="wrap">
                      {DRAWING_FONT_SIZES.map((fontSize) => (
                        <Button
                          key={fontSize}
                          testID={`native-drawing-font-size-${fontSize}`}
                          accessibilityLabel={`Font size ${fontSize}`}
                          accessibilityState={{
                            selected:
                              (style.fontSize ?? DEFAULT_DRAWING_FONT_SIZE) ===
                              fontSize,
                            disabled,
                          }}
                          size="small"
                          variant={
                            (style.fontSize ?? DEFAULT_DRAWING_FONT_SIZE) ===
                            fontSize
                              ? 'primary'
                              : 'secondary'
                          }
                          disabled={disabled}
                          onPress={() => controller.changeStyle({ fontSize })}
                        >
                          {fontSize}
                        </Button>
                      ))}
                    </XStack>
                  </>
                ) : null}
                {hasLine ? (
                  <>
                    <SizableText size="$bodySmMedium">
                      {hasText ? 'Connection line' : 'Line width'}
                    </SizableText>
                    <XStack gap="$2">
                      {[1, 2, 3, 4].map((width) => (
                        <Button
                          key={width}
                          testID={`native-drawing-width-${width}`}
                          flex={1}
                          size="small"
                          variant={
                            style.width === width ? 'primary' : 'secondary'
                          }
                          disabled={disabled}
                          onPress={() => controller.changeStyle({ width })}
                        >
                          {width}
                        </Button>
                      ))}
                    </XStack>
                    <XStack gap="$2">
                      {(['solid', 'dashed', 'dotted'] as const).map((dash) => (
                        <Button
                          key={dash}
                          testID={`native-drawing-style-${dash}`}
                          flex={1}
                          size="small"
                          variant={
                            style.dash === dash ? 'primary' : 'secondary'
                          }
                          disabled={disabled}
                          onPress={() => controller.changeStyle({ dash })}
                        >
                          {dash}
                        </Button>
                      ))}
                    </XStack>
                  </>
                ) : null}
                {hasText && selected ? (
                  <SizableText
                    size="$bodySmMedium"
                    borderTopWidth={1}
                    borderColor="$borderSubdued"
                    pt="$3"
                  >
                    Position
                  </SizableText>
                ) : null}
                {selected?.points
                  .map((point, index) => ({ point, index }))
                  .filter(
                    ({ index }) =>
                      !isFreehandTool(selected.tool) ||
                      index === 0 ||
                      index === selected.points.length - 1,
                  )
                  .map(({ point, index }) => (
                    <YStack key={`${selected.id}-${index}`} gap="$2">
                      <EditField
                        key={point.price}
                        label={`Point ${index + 1} price`}
                        value={String(point.price)}
                        testID={`native-drawing-price-${index}`}
                        disabled={disabled}
                        onSave={(price) => {
                          if (price.trim())
                            controller.editPoint(index, {
                              price: Number(price),
                            });
                        }}
                      />
                      <EditField
                        key={point.time}
                        label={`Point ${index + 1} time (UTC)`}
                        value={new Date(point.time * 1000).toISOString()}
                        testID={`native-drawing-time-${index}`}
                        disabled={disabled}
                        onSave={(time) =>
                          controller.editPoint(index, {
                            time: Date.parse(time) / 1000,
                          })
                        }
                      />
                    </YStack>
                  ))}
              </YStack>
            ) : null}
          </DrawingScrollView>
        </YStack>
      ) : null}
      {state.saveFailed ? (
        <Stack
          position="absolute"
          left={46}
          right={4}
          bottom={30}
          zIndex={5}
          bg="$bgApp"
          p="$2"
        >
          <SizableText size="$bodySm" color="$textCritical">
            Drawings could not be saved on this device.
          </SizableText>
        </Stack>
      ) : null}
    </>
  );
}
