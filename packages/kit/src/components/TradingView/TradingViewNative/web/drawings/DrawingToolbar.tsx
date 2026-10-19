import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type {
  InputHTMLAttributes,
  PointerEvent,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  ButtonFrame,
  Icon,
  IconButton,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
  useTheme,
} from '@onekeyhq/components';
import type {
  IButtonProps,
  ISizableTextProps,
  IXStackProps,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import { EAppSyncStorageKeys } from '@onekeyhq/shared/src/storage/syncStorage';

import { TRADING_VIEW_DRAWING_ICONS } from './icons';
import {
  DEFAULT_DRAWING_FONT_SIZE,
  DRAWING_FONT_SIZES,
  DRAWING_TOOLS,
  MAX_DRAWINGS,
  isFreehandTool,
  isTextDrawingTool,
} from './model';

import type { IDrawingStyle, IDrawingTool } from './model';
import type { IChartDrawingsController } from './useChartDrawings';

type IActionIcon =
  | 'cursor'
  | 'undo'
  | 'redo'
  | 'magnet'
  | 'lock'
  | 'unlock'
  | 'hide'
  | 'show'
  | 'delete'
  | 'stay'
  | 'objects'
  | 'data'
  | 'chevron';

type IPropertiesPosition = { left: number; top: number };

function DrawingButton({
  active,
  disabled,
  disabledOpacity = 0.3,
  menuItem,
  ...props
}: Omit<IButtonProps, 'color'> & {
  active?: boolean;
  disabledOpacity?: number;
  menuItem?: boolean;
}) {
  // Preserve the radio role on a menu item's rendered button.
  const roleProps = menuItem ? { role: undefined } : {};
  return (
    <ButtonFrame
      {...roleProps}
      width={36}
      height={28}
      minWidth={0}
      flexShrink={0}
      padding={0}
      borderWidth={0}
      borderRadius={5}
      backgroundColor={active ? '$bgActive' : '$transparent'}
      cursor={disabled ? 'default' : 'pointer'}
      opacity={disabled ? disabledOpacity : 1}
      disabled={disabled}
      hoverStyle={disabled ? undefined : { backgroundColor: '$bgHover' }}
      focusVisibleStyle={{
        outlineColor: '$iconActive',
        outlineWidth: 2,
        outlineStyle: 'solid',
        outlineOffset: -2,
      }}
      {...props}
    />
  );
}

function DrawingDivider() {
  return (
    <Stack
      width={28}
      height={1}
      flexShrink={0}
      backgroundColor="$borderSubdued"
      marginVertical={3}
    />
  );
}

function DrawingFieldLabel(props: IXStackProps) {
  return (
    <XStack
      render="label"
      alignItems="center"
      gap={8}
      marginVertical={6}
      {...props}
    />
  );
}

function DrawingField(props: ISizableTextProps) {
  return (
    <SizableText
      color="$text"
      backgroundColor="$bg"
      borderColor="$borderSubdued"
      borderWidth={1}
      borderRadius={4}
      fontSize={12}
      lineHeight={18}
      {...props}
    />
  );
}

function DrawingSelect({
  expanded = false,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { expanded?: boolean }) {
  return (
    <DrawingField
      render={<select {...props} />}
      height={expanded ? 30 : 27}
      minWidth={expanded ? 72 : undefined}
      paddingHorizontal={expanded ? 8 : undefined}
    >
      {children}
    </DrawingField>
  );
}

function DrawingInput({
  expanded = false,
  flexible = false,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  expanded?: boolean;
  flexible?: boolean;
}) {
  const isColor = props.type === 'color';
  let width = flexible ? 0 : 180;
  let height: number | undefined;
  if (isColor) {
    width = expanded ? 48 : 28;
    height = expanded ? 30 : 27;
  }
  return (
    <DrawingField
      render={<input {...props} />}
      width={width}
      minWidth={0}
      flex={flexible ? 1 : undefined}
      flexShrink={isColor ? 0 : undefined}
      height={height}
      padding={isColor ? 2 : 5}
      cursor={isColor ? 'pointer' : undefined}
    />
  );
}

export function DrawingIcon({
  name,
  color = 'currentColor',
}: {
  name: keyof typeof TRADING_VIEW_DRAWING_ICONS;
  color?: string;
}) {
  const definition = TRADING_VIEW_DRAWING_ICONS[name];
  return (
    <Stack
      render="span"
      aria-hidden
      alignItems="center"
      justifyContent="center"
      flexShrink={0}
      pointerEvents="none"
      width={name === 'chevron' ? 12 : 20}
      height={name === 'chevron' ? 12 : 20}
    >
      {'icon' in definition ? (
        <Icon
          name={definition.icon}
          size={name === 'chevron' ? '$3' : '$5'}
          style={{ color }}
        />
      ) : (
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="square"
          strokeLinejoin="miter"
          focusable="false"
        >
          <path d={definition.path} />
        </svg>
      )}
    </Stack>
  );
}

function ToolButton({
  label,
  icon,
  active,
  disabled,
  disabledOpacity,
  onClick,
  children,
  testID,
  compact = false,
}: {
  label: string;
  icon?: IDrawingTool | IActionIcon;
  active?: boolean;
  disabled?: boolean;
  disabledOpacity?: number;
  onClick: () => void;
  children?: ReactNode;
  testID?: string;
  compact?: boolean;
}) {
  const theme = useTheme();
  return (
    <DrawingButton
      render={<button type="button" title={label} aria-label={label} />}
      testID={testID}
      aria-label={label}
      aria-pressed={active}
      active={active}
      disabled={disabled}
      disabledOpacity={disabledOpacity}
      width={compact ? 28 : 36}
      onPress={onClick}
    >
      {icon ? (
        <DrawingIcon
          name={icon}
          color={active ? theme.iconActive.val : theme.iconSubdued.val}
        />
      ) : (
        children
      )}
    </DrawingButton>
  );
}

function FontSizeSelect({
  id,
  value = DEFAULT_DRAWING_FONT_SIZE,
  disabled,
  onChange,
  expanded,
}: {
  id?: string;
  value?: number;
  disabled: boolean;
  onChange: (fontSize: number) => void;
  expanded?: boolean;
}) {
  return (
    <DrawingSelect
      expanded={expanded}
      id={id}
      aria-label="Font size"
      data-testid="chart-drawing-font-size"
      title="Font size"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value))}
    >
      {DRAWING_FONT_SIZES.map((fontSize) => (
        <option key={fontSize} value={fontSize}>
          {fontSize}
        </option>
      ))}
    </DrawingSelect>
  );
}

function LineStyleControls({
  style,
  disabled,
  onChange,
}: {
  style: IDrawingStyle;
  disabled: boolean;
  onChange: (style: Partial<IDrawingStyle>) => void;
}) {
  return (
    <>
      <DrawingSelect
        aria-label="Line width"
        value={style.width}
        disabled={disabled}
        onChange={(event) => onChange({ width: Number(event.target.value) })}
      >
        {[1, 2, 3, 4].map((width) => (
          <option key={width} value={width}>
            {width} px
          </option>
        ))}
      </DrawingSelect>
      <DrawingSelect
        aria-label="Line style"
        value={style.dash}
        disabled={disabled}
        onChange={(event) =>
          onChange({
            dash: event.target.value as IDrawingStyle['dash'],
          })
        }
      >
        <option value="solid">Solid</option>
        <option value="dashed">Dashed</option>
        <option value="dotted">Dotted</option>
      </DrawingSelect>
    </>
  );
}

export function DrawingToolbar({
  controller,
  mainChartBottomInset,
}: {
  controller: IChartDrawingsController;
  mainChartBottomInset: number;
}) {
  const theme = useTheme();
  const fontSizeControlId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const propertiesRef = useRef<HTMLDivElement>(null);
  const coordinatesRef = useRef<HTMLDivElement>(null);
  const settingsBodyRef = useRef<HTMLDivElement>(null);
  const propertiesDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    position: IPropertiesPosition;
  } | null>(null);
  const [propertiesPosition, setPropertiesPosition] =
    useState<IPropertiesPosition>({ left: 62, top: 8 });
  const intl = useIntl();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return (
        appStorage.syncStorage.getBoolean(
          EAppSyncStorageKeys.onekey_trading_view_native_drawing_toolbar_collapsed,
        ) === true
      );
    } catch {
      return false;
    }
  });
  const toggleToolbarLabel = intl.formatMessage({
    id: collapsed ? ETranslations.global_expand : ETranslations.global_collapse,
  });
  const [positionExpanded, setPositionExpanded] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [lastTools, setLastTools] = useState<Record<string, IDrawingTool>>({
    Lines: 'trend',
  });
  const { state } = controller;
  const selected = state.history.present.find(
    (drawing) => drawing.id === state.selectedId,
  );
  const propertiesVisible =
    !menu && !state.hidden && Boolean(selected || state.tool !== 'cursor');
  const settingsVisible =
    propertiesVisible && Boolean(selected && state.editingCoordinates);
  const clampPropertiesPosition = useCallback(
    (position: IPropertiesPosition): IPropertiesPosition => {
      const panel = propertiesRef.current;
      const container = panel?.offsetParent;
      if (!panel || !(container instanceof HTMLElement)) return position;
      const minLeft = (rootRef.current?.offsetWidth ?? 48) + 8;
      return {
        left: Math.max(
          minLeft,
          Math.min(
            position.left,
            container.clientWidth - panel.offsetWidth - 8,
          ),
        ),
        top: Math.max(
          8,
          Math.min(
            position.top,
            container.clientHeight - panel.offsetHeight - 8,
          ),
        ),
      };
    },
    [],
  );
  useEffect(() => {
    const panel = propertiesRef.current;
    const container = panel?.offsetParent;
    if (!propertiesVisible || !panel || !(container instanceof HTMLElement))
      return undefined;
    const resizeObserver = new ResizeObserver(() => {
      setPropertiesPosition((current) => {
        const next = clampPropertiesPosition(current);
        return next.left === current.left && next.top === current.top
          ? current
          : next;
      });
    });
    resizeObserver.observe(panel);
    resizeObserver.observe(container);
    if (rootRef.current) resizeObserver.observe(rootRef.current);
    return () => {
      resizeObserver.disconnect();
      propertiesDragRef.current = null;
    };
  }, [clampPropertiesPosition, propertiesVisible]);
  useLayoutEffect(() => {
    const panel = propertiesRef.current;
    const dialog = coordinatesRef.current;
    const container = panel?.offsetParent;
    if (
      !settingsVisible ||
      !panel ||
      !dialog ||
      !(container instanceof HTMLElement)
    )
      return undefined;
    const body = settingsBodyRef.current;
    const updateSettingsPosition = () => {
      const minLeft = (rootRef.current?.offsetWidth ?? 48) + 8;
      dialog.style.maxWidth = `${Math.max(0, container.clientWidth - minLeft - 8)}px`;
      const belowTop = panel.offsetTop + panel.offsetHeight + 6;
      const spaceBelow = Math.max(0, container.clientHeight - belowTop - 8);
      const spaceAbove = Math.max(0, panel.offsetTop - 6 - 8);
      // Include the text body's scroll overflow when deciding whether to flip.
      const contentHeight =
        dialog.scrollHeight +
        dialog.offsetHeight -
        dialog.clientHeight +
        (body ? Math.max(0, body.scrollHeight - body.clientHeight) : 0);
      const below = contentHeight <= spaceBelow || spaceBelow >= spaceAbove;
      dialog.style.maxHeight = `${below ? spaceBelow : spaceAbove}px`;
      dialog.style.left = `${Math.max(
        minLeft,
        Math.min(
          panel.offsetLeft,
          container.clientWidth - dialog.offsetWidth - 8,
        ),
      )}px`;
      dialog.style.top = below ? `${belowTop}px` : 'auto';
      dialog.style.bottom = below
        ? 'auto'
        : `${container.clientHeight - panel.offsetTop + 6}px`;
    };
    updateSettingsPosition();
    const resizeObserver = new ResizeObserver(updateSettingsPosition);
    resizeObserver.observe(panel);
    resizeObserver.observe(dialog);
    resizeObserver.observe(container);
    if (body) resizeObserver.observe(body);
    const textArea = dialog.querySelector('textarea');
    if (textArea) resizeObserver.observe(textArea);
    return () => {
      resizeObserver.disconnect();
    };
  }, [
    positionExpanded,
    propertiesPosition,
    selected?.id,
    selected?.text,
    settingsVisible,
  ]);
  const finishPropertiesDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (propertiesDragRef.current?.pointerId !== event.pointerId) return;
    propertiesDragRef.current = null;
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const style = selected ?? state.style;
  const activeTool = selected?.tool ?? state.tool;
  const hasText = isTextDrawingTool(activeTool);
  const hasLine = activeTool !== 'text' && activeTool !== 'priceLabel';
  const groups = [
    ...new Set(Object.values(DRAWING_TOOLS).map((tool) => tool.group)),
  ];
  // Hydration pauses drawing actions on each symbol switch without dimming their icons.
  const disabled = !state.ready;
  const styleDisabled = Boolean(selected && (selected.locked || state.locked));
  const pointFields =
    selected && state.editingCoordinates ? (
      <>
        {selected.points
          .map((point, index) => ({ point, index }))
          .filter(
            ({ index }) =>
              !isFreehandTool(selected.tool) ||
              index === 0 ||
              index === selected.points.length - 1,
          )
          .map(({ point, index }) => (
            <YStack key={`${selected.id}-${index}`}>
              <DrawingFieldLabel>
                <SizableText fontSize={12}>Point {index + 1}</SizableText>
                <DrawingInput
                  flexible={hasText}
                  aria-label={`Point ${index + 1} price`}
                  key={point.price}
                  type="number"
                  step="any"
                  defaultValue={point.price}
                  disabled={styleDisabled}
                  onBlur={(event) => {
                    if (event.target.value !== '')
                      controller.editPoint(index, {
                        price: event.target.valueAsNumber,
                      });
                  }}
                />
              </DrawingFieldLabel>
              <DrawingFieldLabel>
                <SizableText fontSize={12}>Time (UTC)</SizableText>
                <DrawingInput
                  flexible={hasText}
                  aria-label={`Point ${index + 1} time`}
                  key={point.time}
                  type="datetime-local"
                  step="1"
                  defaultValue={new Date(point.time * 1000)
                    .toISOString()
                    .slice(0, 19)}
                  disabled={styleDisabled}
                  onBlur={(event) => {
                    if (event.target.value)
                      controller.editPoint(index, {
                        time:
                          new Date(`${event.target.value}Z`).getTime() / 1000,
                      });
                  }}
                />
              </DrawingFieldLabel>
            </YStack>
          ))}
      </>
    ) : null;
  let hint = state.draft
    ? 'Click to finish · Esc to cancel'
    : 'Click to place a point · Esc to cancel';
  if (state.history.present.length >= MAX_DRAWINGS)
    hint = 'Drawing limit reached. Remove a drawing to continue.';
  if (state.saveFailed) hint = 'Drawings could not be saved on this device.';
  if (state.tool !== 'cursor' && isFreehandTool(state.tool))
    hint = 'Click and drag to draw · Esc to cancel';
  const shortcuts: Partial<Record<IDrawingTool, string>> = {
    trend: 'Alt T',
    horizontal: 'Alt H',
    vertical: 'Alt V',
    cross: 'Alt C',
    fib: 'Alt F',
    rectangle: 'Alt ⇧ R',
  };
  useEffect(() => {
    if (!menu) return undefined;
    const close = (event: globalThis.PointerEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      )
        setMenu(null);
    };
    document.addEventListener('pointerdown', close);
    const navigate = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenu(null);
        return;
      }
      const items = Array.from(
        rootRef.current?.querySelectorAll<HTMLButtonElement>(
          '[role="menuitemradio"]',
        ) ?? [],
      );
      const index = items.findIndex((item) => item === document.activeElement);
      if (event.key === 'ArrowDown') items[(index + 1) % items.length]?.focus();
      else if (event.key === 'ArrowUp')
        items[(index + items.length - 1) % items.length]?.focus();
      else if (event.key === 'Home') items[0]?.focus();
      else if (event.key === 'End') items.at(-1)?.focus();
      else return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    document.addEventListener('keydown', navigate, true);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', navigate, true);
    };
  }, [menu]);
  return (
    <YStack
      render={<div ref={rootRef} data-collapsed={collapsed} />}
      testID="chart-drawing-toolbar"
      role="group"
      aria-label="Chart drawings"
      position="static"
      width={collapsed ? 0 : 48}
      flexShrink={0}
      borderRightWidth={collapsed ? 0 : 1}
      borderColor="$borderSubdued"
      paddingVertical={2}
      backgroundColor="$transparent"
      zIndex={4}
    >
      <ScrollView
        display={collapsed ? 'none' : 'flex'}
        flex={1}
        minHeight={0}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ alignItems: 'center' }}
        role="toolbar"
        aria-label="Drawing tools"
        aria-orientation="vertical"
      >
        <ToolButton
          label="Cursor (Esc)"
          icon="cursor"
          active={state.tool === 'cursor'}
          onClick={() => {
            controller.selectTool('cursor');
            setMenu(null);
          }}
        />
        <DrawingDivider />
        {groups.map((group) => {
          const tool =
            lastTools[group] ??
            (Object.keys(DRAWING_TOOLS) as IDrawingTool[]).find(
              (key) => DRAWING_TOOLS[key].group === group,
            ) ??
            'trend';
          return (
            <XStack
              key={group}
              alignItems="center"
              justifyContent="center"
              width="100%"
            >
              <ToolButton
                label={DRAWING_TOOLS[tool].label}
                icon={tool}
                disabled={disabled}
                disabledOpacity={1}
                active={
                  state.tool !== 'cursor' &&
                  DRAWING_TOOLS[state.tool].group === group
                }
                onClick={() => {
                  controller.selectTool(tool);
                  setMenu(null);
                }}
              />
              <DrawingButton
                render={
                  <button type="button" title={group} aria-label={group} />
                }
                position="absolute"
                right={0}
                width={12}
                aria-label={group}
                aria-haspopup="menu"
                aria-expanded={menu === group}
                disabled={disabled}
                disabledOpacity={1}
                onPress={() => setMenu(menu === group ? null : group)}
              >
                <DrawingIcon name="chevron" color={theme.iconSubdued.val} />
              </DrawingButton>
            </XStack>
          );
        })}
        <DrawingDivider />
        <ToolButton
          label="Magnet mode"
          icon="magnet"
          active={state.magnet}
          onClick={() => controller.toggle('magnet')}
        />
        <ToolButton
          label="Stay in drawing mode"
          icon="stay"
          active={state.stayInDrawingMode}
          onClick={() => controller.toggle('stayInDrawingMode')}
        />
        <ToolButton
          label={state.locked ? 'Unlock all drawings' : 'Lock all drawings'}
          icon={state.locked ? 'lock' : 'unlock'}
          active={state.locked}
          onClick={() => controller.toggle('locked')}
        />
        <ToolButton
          label={state.hidden ? 'Show drawings' : 'Hide drawings'}
          icon={state.hidden ? 'show' : 'hide'}
          active={state.hidden}
          onClick={() => controller.toggle('hidden')}
        />
        <DrawingDivider />
        <ToolButton
          label="Undo drawing (Ctrl/⌘ Z)"
          icon="undo"
          disabled={!state.history.past.length}
          onClick={() => controller.historyAction('undo')}
        />
        <ToolButton
          label="Redo drawing (Ctrl/⌘ Y)"
          icon="redo"
          disabled={!state.history.future.length}
          onClick={() => controller.historyAction('redo')}
        />
        <ToolButton
          label="Remove unlocked drawings"
          icon="delete"
          disabled={
            state.locked ||
            !state.history.present.some((drawing) => !drawing.locked)
          }
          onClick={controller.clear}
        />
        <ToolButton
          label="Object Tree"
          icon="objects"
          testID="chart-object-tree-toggle"
          active={state.panel === 'objects'}
          onClick={() => {
            controller.togglePanel('objects');
            setMenu(null);
          }}
        />
        <ToolButton
          label="Data Window"
          icon="data"
          testID="chart-data-window-toggle"
          active={state.panel === 'data'}
          onClick={() => {
            controller.togglePanel('data');
            setMenu(null);
          }}
        />
      </ScrollView>
      <Stack
        position="absolute"
        left={collapsed ? 10 : 39}
        bottom={mainChartBottomInset + 8}
        width={16}
        height={32}
        borderRadius="$full"
        backgroundColor="$bg"
        zIndex={5}
      >
        <IconButton
          testID="chart-drawing-toolbar-toggle"
          aria-label={toggleToolbarLabel}
          title={toggleToolbarLabel}
          aria-expanded={!collapsed}
          icon={
            collapsed ? 'ChevronRightSmallOutline' : 'ChevronLeftSmallOutline'
          }
          iconSize="$3"
          iconProps={{ color: '$text' }}
          hotKey
          width={16}
          height={32}
          padding={0}
          borderWidth={1}
          borderColor="$borderSubdued"
          borderRadius="$full"
          backgroundColor="$transparent"
          hoverStyle={{ backgroundColor: '$bgHover' }}
          pressStyle={{ backgroundColor: '$bgActive' }}
          onPress={() => {
            setCollapsed(!collapsed);
            try {
              void Promise.resolve(
                appStorage.syncStorage.set(
                  EAppSyncStorageKeys.onekey_trading_view_native_drawing_toolbar_collapsed,
                  !collapsed,
                ),
              ).catch(() => undefined);
            } catch {
              // Keep the toolbar usable when preference storage is unavailable.
            }
            setMenu(null);
          }}
        />
      </Stack>
      {menu ? (
        <ScrollView
          position="absolute"
          left={52}
          top={8}
          width={232}
          maxHeight="calc(100% - 16px)"
          backgroundColor="$bg"
          borderWidth={1}
          borderColor="$borderSubdued"
          borderRadius={8}
          shadowColor="#000000"
          shadowOffset={{ width: 0, height: 6 }}
          shadowRadius={24}
          shadowOpacity={0.13}
          contentContainerStyle={{ padding: 6 }}
          zIndex={10}
          role="menu"
          aria-label={menu}
        >
          <SizableText
            paddingVertical={9}
            paddingHorizontal={10}
            fontSize={11}
            fontWeight="600"
            color="$textSubdued"
            textTransform="uppercase"
            letterSpacing={0.8}
          >
            {menu}
          </SizableText>
          {(Object.keys(DRAWING_TOOLS) as IDrawingTool[])
            .filter((tool) => DRAWING_TOOLS[tool].group === menu)
            .map((tool) => (
              <DrawingButton
                key={tool}
                menuItem
                render={
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={state.tool === tool}
                    aria-label={DRAWING_TOOLS[tool].label}
                  />
                }
                aria-label={DRAWING_TOOLS[tool].label}
                aria-checked={state.tool === tool}
                active={state.tool === tool}
                width="100%"
                height={38}
                paddingHorizontal={10}
                justifyContent="flex-start"
                gap={14}
                borderRadius={4}
                onPress={() => {
                  controller.selectTool(tool);
                  setLastTools((current) => ({ ...current, [menu]: tool }));
                  setMenu(null);
                }}
              >
                <DrawingIcon
                  name={tool}
                  color={
                    state.tool === tool
                      ? theme.iconActive.val
                      : theme.iconSubdued.val
                  }
                />
                <SizableText fontSize={13}>
                  {DRAWING_TOOLS[tool].label}
                </SizableText>
                <SizableText
                  marginLeft="auto"
                  color="$textSubdued"
                  fontSize={10}
                >
                  {shortcuts[tool]}
                </SizableText>
              </DrawingButton>
            ))}
        </ScrollView>
      ) : null}
      {propertiesVisible ? (
        <XStack
          render={<div ref={propertiesRef} />}
          testID="chart-drawing-properties"
          role="toolbar"
          aria-label="Drawing properties"
          position="absolute"
          left={propertiesPosition.left}
          top={propertiesPosition.top}
          width="max-content"
          maxWidth="calc(100% - 136px)"
          minHeight={46}
          alignItems="center"
          gap={6}
          paddingVertical={3}
          paddingHorizontal={6}
          backgroundColor="$bg"
          borderWidth={1}
          borderColor="$borderSubdued"
          borderRadius={7}
          shadowColor="#000000"
          shadowOffset={{ width: 0, height: 3 }}
          shadowRadius={12}
          shadowOpacity={0.07}
          overflowX="auto"
          zIndex={3}
        >
          <DrawingButton
            width={20}
            cursor="grab"
            pressStyle={{ cursor: 'grabbing' }}
            userSelect="none"
            render={
              <button
                type="button"
                style={{ touchAction: 'none' }}
                data-testid="chart-drawing-properties-drag-handle"
                aria-label="Move drawing properties"
                title="Drag to move"
                onPointerDown={(event) => {
                  const panel = propertiesRef.current;
                  if (event.button !== 0 || !event.isPrimary || !panel) return;
                  event.preventDefault();
                  event.stopPropagation();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  propertiesDragRef.current = {
                    pointerId: event.pointerId,
                    startX: event.clientX,
                    startY: event.clientY,
                    position: { left: panel.offsetLeft, top: panel.offsetTop },
                  };
                }}
                onPointerMove={(event) => {
                  const drag = propertiesDragRef.current;
                  if (!drag || drag.pointerId !== event.pointerId) return;
                  event.preventDefault();
                  event.stopPropagation();
                  setPropertiesPosition(
                    clampPropertiesPosition({
                      left: drag.position.left + event.clientX - drag.startX,
                      top: drag.position.top + event.clientY - drag.startY,
                    }),
                  );
                }}
                onPointerUp={finishPropertiesDrag}
                onPointerCancel={finishPropertiesDrag}
                onLostPointerCapture={() => {
                  propertiesDragRef.current = null;
                }}
                onKeyDown={(event) => {
                  const x =
                    Number(event.key === 'ArrowRight') -
                    Number(event.key === 'ArrowLeft');
                  const y =
                    Number(event.key === 'ArrowDown') -
                    Number(event.key === 'ArrowUp');
                  if (!x && !y) return;
                  event.preventDefault();
                  event.stopPropagation();
                  setPropertiesPosition((current) =>
                    clampPropertiesPosition({
                      left: current.left + x * 10,
                      top: current.top + y * 10,
                    }),
                  );
                }}
              />
            }
          >
            <Stack aria-hidden pointerEvents="none">
              <Icon name="DragOutline" size="$4" color="$textSubdued" />
            </Stack>
          </DrawingButton>
          <SizableText
            fontSize={12}
            marginHorizontal={4}
            whiteSpace="nowrap"
            flexShrink={0}
          >
            {
              DRAWING_TOOLS[
                selected?.tool ??
                  (state.tool === 'cursor' ? 'trend' : state.tool)
              ].label
            }
          </SizableText>
          <DrawingInput
            type="color"
            aria-label="Drawing color"
            title="Color"
            value={style.color}
            disabled={styleDisabled}
            onChange={(event) =>
              controller.changeStyle({ color: event.target.value })
            }
          />
          {hasText ? (
            <FontSizeSelect
              value={style.fontSize}
              disabled={styleDisabled}
              onChange={(fontSize) => controller.changeStyle({ fontSize })}
            />
          ) : null}
          {hasLine ? (
            <LineStyleControls
              style={style}
              disabled={styleDisabled}
              onChange={controller.changeStyle}
            />
          ) : null}
          {selected ? (
            <>
              <DrawingButton
                width="auto"
                paddingHorizontal={5}
                onPress={controller.toggleCoordinates}
              >
                <SizableText fontSize={12} color="$iconSubdued">
                  Settings
                </SizableText>
              </DrawingButton>
              <ToolButton
                compact
                label={selected.locked ? 'Unlock drawing' : 'Lock drawing'}
                icon={selected.locked ? 'lock' : 'unlock'}
                active={selected.locked}
                disabled={state.locked}
                onClick={controller.toggleSelectedLock}
              />
              <ToolButton
                compact
                label="Delete drawing"
                icon="delete"
                disabled={styleDisabled}
                onClick={controller.removeSelected}
              />
            </>
          ) : null}
        </XStack>
      ) : null}
      {selected && settingsVisible ? (
        <YStack
          render={<div ref={coordinatesRef} />}
          testID="chart-drawing-settings"
          role="dialog"
          aria-label="Drawing settings"
          position="absolute"
          width={hasText ? 300 : undefined}
          maxWidth={hasText ? 'calc(100% - 100px)' : undefined}
          maxHeight="calc(100% - 90px)"
          overflow="hidden"
          backgroundColor="$bg"
          borderWidth={1}
          borderColor="$borderSubdued"
          borderRadius={7}
          padding={12}
          shadowColor="#000000"
          shadowOffset={{ width: 0, height: 3 }}
          shadowRadius={12}
          shadowOpacity={0.07}
          zIndex={4}
        >
          <SizableText fontSize={12} fontWeight="600" flexShrink={0}>
            {DRAWING_TOOLS[selected.tool].label}
          </SizableText>
          <YStack
            render={<div ref={settingsBodyRef} />}
            minHeight={0}
            flexShrink={1}
            overflowY="auto"
          >
            {selected.tool === 'text' || selected.tool === 'callout' ? (
              <YStack render="label" gap={6} marginVertical={10}>
                <SizableText fontSize={12}>Content</SizableText>
                <DrawingField
                  key={`${selected.id}-text-${selected.text ?? ''}`}
                  width="100%"
                  minHeight={72}
                  padding={10}
                  borderRadius={5}
                  render={
                    <textarea
                      aria-label="Drawing text"
                      data-testid="chart-drawing-text"
                      maxLength={500}
                      defaultValue={selected.text ?? 'Text'}
                      disabled={styleDisabled}
                      style={{ resize: 'vertical' }}
                      onBlur={(event) =>
                        controller.changeStyle({ text: event.target.value })
                      }
                    />
                  }
                />
              </YStack>
            ) : null}
            {hasText ? (
              <XStack alignItems="center" gap={20} marginBottom={12}>
                <DrawingFieldLabel
                  flexDirection="column"
                  alignItems="flex-start"
                >
                  <SizableText fontSize={12}>Text color</SizableText>
                  <DrawingInput
                    expanded
                    type="color"
                    aria-label="Text color"
                    value={style.color}
                    disabled={styleDisabled}
                    onChange={(event) =>
                      controller.changeStyle({ color: event.target.value })
                    }
                  />
                </DrawingFieldLabel>
                <DrawingFieldLabel
                  render={
                    <label htmlFor={fontSizeControlId} aria-label="Font size" />
                  }
                  flexDirection="column"
                  alignItems="flex-start"
                >
                  <SizableText fontSize={12}>Font size</SizableText>
                  <FontSizeSelect
                    expanded
                    id={fontSizeControlId}
                    value={style.fontSize}
                    disabled={styleDisabled}
                    onChange={(fontSize) =>
                      controller.changeStyle({ fontSize })
                    }
                  />
                </DrawingFieldLabel>
              </XStack>
            ) : null}
            {activeTool === 'callout' ? (
              <YStack
                borderTopWidth={1}
                borderColor="$borderSubdued"
                paddingTop={10}
                marginBottom={8}
              >
                <SizableText fontSize={12} marginBottom={8} fontWeight="600">
                  Connection line
                </SizableText>
                <XStack gap={6}>
                  <LineStyleControls
                    style={style}
                    disabled={styleDisabled}
                    onChange={controller.changeStyle}
                  />
                </XStack>
              </YStack>
            ) : null}
            {hasText ? (
              <YStack
                borderTopWidth={1}
                borderColor="$borderSubdued"
                paddingTop={10}
                marginBottom={8}
              >
                <DrawingButton
                  aria-expanded={positionExpanded}
                  width="auto"
                  alignSelf="flex-start"
                  gap={4}
                  onPress={() => setPositionExpanded(!positionExpanded)}
                >
                  <Icon
                    name={
                      positionExpanded
                        ? 'ChevronDownSmallOutline'
                        : 'ChevronRightSmallOutline'
                    }
                    size="$3"
                    color="$textSubdued"
                  />
                  <SizableText fontSize={12} fontWeight="600">
                    Position
                  </SizableText>
                </DrawingButton>
                {positionExpanded ? pointFields : null}
              </YStack>
            ) : (
              pointFields
            )}
          </YStack>
          <Button
            testID="chart-drawing-settings-done"
            onPress={controller.toggleCoordinates}
            size="small"
            alignSelf="flex-end"
            flexShrink={0}
            backgroundColor="$transparent"
            borderWidth={1}
            borderColor="$borderSubdued"
            borderRadius={4}
            paddingVertical={5}
            paddingHorizontal={12}
            marginTop={6}
            childrenAsText={false}
          >
            <SizableText fontSize={12}>Done</SizableText>
          </Button>
        </YStack>
      ) : null}
      {state.saveFailed ||
      state.history.present.length >= MAX_DRAWINGS ||
      state.tool !== 'cursor' ? (
        <SizableText
          role="status"
          position="absolute"
          left={62}
          bottom={32}
          paddingVertical={5}
          paddingHorizontal={9}
          borderRadius={4}
          backgroundColor="$bg"
          color="$textSubdued"
          fontSize={11}
          pointerEvents="none"
          zIndex={2}
        >
          {hint}
        </SizableText>
      ) : null}
    </YStack>
  );
}
