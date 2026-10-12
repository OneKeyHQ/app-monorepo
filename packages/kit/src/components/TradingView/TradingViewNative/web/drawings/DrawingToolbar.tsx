import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { CSSProperties, PointerEvent, ReactNode } from 'react';

import { Icon, useTheme } from '@onekeyhq/components';

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
  | 'chevron';

type IPropertiesPosition = { left: number; top: number };

export function DrawingIcon({
  name,
}: {
  name: keyof typeof TRADING_VIEW_DRAWING_ICONS;
}) {
  const definition = TRADING_VIEW_DRAWING_ICONS[name];
  return (
    <span
      aria-hidden="true"
      className="chart-drawing-icon"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        pointerEvents: 'none',
        width: name === 'chevron' ? 12 : 20,
        height: name === 'chevron' ? 12 : 20,
      }}
    >
      {'icon' in definition ? (
        <Icon
          name={definition.icon}
          size={name === 'chevron' ? '$3' : '$5'}
          style={{ color: 'currentColor' }}
        />
      ) : (
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="square"
          strokeLinejoin="miter"
          focusable="false"
        >
          <path d={definition.path} />
        </svg>
      )}
    </span>
  );
}

function ToolButton({
  label,
  icon,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  icon?: IDrawingTool | IActionIcon;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      className="chart-drawing-button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      {icon ? <DrawingIcon name={icon} /> : children}
    </button>
  );
}

function FontSizeSelect({
  id,
  value = DEFAULT_DRAWING_FONT_SIZE,
  disabled,
  onChange,
}: {
  id?: string;
  value?: number;
  disabled: boolean;
  onChange: (fontSize: number) => void;
}) {
  return (
    <select
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
    </select>
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
      <select
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
      </select>
      <select
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
      </select>
    </>
  );
}

const toolbarCss = `
.chart-drawing-toolbar { width:48px; flex-shrink:0; display:flex; flex-direction:column; border-right:1px solid var(--drawing-border); padding:2px 0; box-sizing:border-box; background:var(--drawing-bg); color:var(--drawing-text); z-index:4; }
.chart-drawing-toolbar[data-collapsed=true] { width:18px; }
.chart-drawing-collapse { width:100%; height:22px; flex-shrink:0; }
.chart-drawing-rail { flex:1; min-height:0; overflow-y:auto; scrollbar-width:none; display:flex; flex-direction:column; align-items:center; gap:0; }
.chart-drawing-button { display:flex; align-items:center; justify-content:center; flex-shrink:0; width:36px; height:28px; border:0; border-radius:5px; background:transparent; color:var(--drawing-icon); cursor:pointer; padding:0; }
.chart-drawing-button:hover:not(:disabled), .chart-drawing-menu button:hover { background:var(--drawing-hover); }
.chart-drawing-button:focus-visible, .chart-drawing-menu button:focus-visible { outline:2px solid var(--drawing-icon-active); outline-offset:-2px; }
.chart-drawing-button[aria-pressed=true] { color:var(--drawing-icon-active); background:var(--drawing-active); }
.chart-drawing-button:disabled { opacity:.3; cursor:default; }
.chart-drawing-divider { width:28px; height:1px; background:var(--drawing-border); margin:3px 0; flex-shrink:0; }
.chart-drawing-group { position:relative; display:flex; align-items:center; justify-content:center; width:100%; }
.chart-drawing-group > .chart-drawing-button:last-child { position:absolute; right:0; width:12px; }
.chart-drawing-menu { position:absolute; left:52px; top:8px; width:232px; max-height:calc(100% - 16px); overflow-y:auto; background:var(--drawing-bg); border:1px solid var(--drawing-border); border-radius:8px; box-shadow:0 6px 24px #0002; padding:6px; z-index:10; }
.chart-drawing-menu-title { padding:9px 10px; font-size:11px; font-weight:600; color:var(--drawing-muted); text-transform:uppercase; letter-spacing:.8px; }
.chart-drawing-menu button { display:flex; align-items:center; gap:14px; width:100%; height:38px; padding:0 10px; border:0; border-radius:4px; background:transparent; color:inherit; font:inherit; font-size:13px; cursor:pointer; text-align:left; }
.chart-drawing-menu .chart-drawing-icon { color:var(--drawing-icon); }
.chart-drawing-menu button[aria-checked=true] { background:var(--drawing-active); }
.chart-drawing-menu button[aria-checked=true] .chart-drawing-icon { color:var(--drawing-icon-active); }
.chart-drawing-properties { position:absolute; top:8px; left:62px; display:flex; align-items:center; gap:6px; width:max-content; max-width:calc(100% - 136px); overflow-x:auto; min-height:38px; padding:3px 6px; background:var(--drawing-bg); color:var(--drawing-text); border:1px solid var(--drawing-border); border-radius:7px; box-shadow:0 3px 12px #0001; z-index:3; }
.chart-drawing-properties select, .chart-drawing-properties input { background:var(--drawing-bg); color:var(--drawing-text); border:1px solid var(--drawing-border); border-radius:4px; height:27px; font:inherit; font-size:12px; }
.chart-drawing-properties input[type=color] { width:28px; padding:2px; cursor:pointer; }
.chart-drawing-properties .chart-drawing-button { width:28px; height:28px; }
.chart-drawing-properties .chart-drawing-drag-handle { width:20px; color:var(--drawing-muted); cursor:grab; touch-action:none; user-select:none; }
.chart-drawing-properties .chart-drawing-drag-handle:active { cursor:grabbing; }
.chart-drawing-properties-label { font-size:12px; margin:0 4px; white-space:nowrap; }
.chart-drawing-coordinates { position:absolute; box-sizing:border-box; max-height:calc(100% - 90px); overflow:auto; background:var(--drawing-bg); border:1px solid var(--drawing-border); border-radius:7px; padding:12px; box-shadow:0 3px 12px #0001; z-index:4; font-size:12px; }
.chart-drawing-coordinates label { display:flex; align-items:center; gap:8px; margin:6px 0; }
.chart-drawing-coordinates input { width:180px; background:var(--drawing-bg); color:var(--drawing-text); border:1px solid var(--drawing-border); padding:5px; border-radius:4px; }
.chart-drawing-text-settings { overflow:hidden; display:flex; flex-direction:column; width:300px; max-width:calc(100% - 100px); box-sizing:border-box; }
.chart-drawing-settings-body { display:contents; }
.chart-drawing-text-settings .chart-drawing-settings-body { display:block; min-height:0; overflow-y:auto; }
.chart-drawing-text-settings .chart-drawing-settings-done { align-self:flex-end; flex-shrink:0; }
.chart-drawing-text-settings .chart-drawing-text-content { display:flex; flex-direction:column; align-items:stretch; gap:6px; margin:10px 0; }
.chart-drawing-text-settings textarea { box-sizing:border-box; width:100%; min-height:72px; resize:vertical; padding:10px; background:var(--drawing-bg); color:var(--drawing-text); border:1px solid var(--drawing-border); border-radius:5px; font:inherit; line-height:1.5; }
.chart-drawing-text-appearance { display:flex; align-items:center; gap:20px; margin-bottom:12px; }
.chart-drawing-text-appearance label { flex-direction:column; align-items:flex-start; }
.chart-drawing-text-settings select { min-width:72px; height:30px; padding:0 8px; background:var(--drawing-bg); color:var(--drawing-text); border:1px solid var(--drawing-border); border-radius:4px; font:inherit; }
.chart-drawing-text-appearance input[type=color] { width:48px; height:30px; padding:2px; cursor:pointer; }
.chart-drawing-text-position { border-top:1px solid var(--drawing-border); padding-top:10px; margin-bottom:8px; }
.chart-drawing-text-position summary { cursor:pointer; font-weight:600; }
.chart-drawing-text-settings input:not([type=color]) { min-width:0; width:0; flex:1; }
.chart-drawing-shortcut { margin-left:auto; color:var(--drawing-muted); font-size:10px; }
.chart-drawing-hint { position:absolute; left:62px; bottom:32px; padding:5px 9px; border-radius:4px; background:var(--drawing-bg); color:var(--drawing-muted); font-size:11px; pointer-events:none; z-index:2; }
`;

export function DrawingToolbar({
  controller,
}: {
  controller: IChartDrawingsController;
}) {
  const theme = useTheme();
  const fontSizeControlId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const propertiesRef = useRef<HTMLDivElement>(null);
  const coordinatesRef = useRef<HTMLDivElement>(null);
  const propertiesDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    position: IPropertiesPosition;
  } | null>(null);
  const [propertiesPosition, setPropertiesPosition] =
    useState<IPropertiesPosition>({ left: 62, top: 8 });
  const [collapsed, setCollapsed] = useState(false);
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
    const body = dialog.querySelector<HTMLElement>(
      '.chart-drawing-settings-body',
    );
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
    dialog.addEventListener('toggle', updateSettingsPosition, true);
    return () => {
      resizeObserver.disconnect();
      dialog.removeEventListener('toggle', updateSettingsPosition, true);
    };
  }, [propertiesPosition, selected?.id, selected?.text, settingsVisible]);
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
            <div key={`${selected.id}-${index}`}>
              <label>
                Point {index + 1}
                <input
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
              </label>
              <label>
                Time (UTC)
                <input
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
              </label>
            </div>
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
    <div
      ref={rootRef}
      className="chart-drawing-toolbar"
      data-testid="chart-drawing-toolbar"
      data-collapsed={collapsed}
      role="group"
      aria-label="Chart drawings"
      style={
        {
          '--drawing-bg': theme.bg.val,
          '--drawing-border': theme.borderSubdued.val,
          '--drawing-text': theme.text.val,
          '--drawing-muted': theme.textSubdued.val,
          '--drawing-icon': theme.iconSubdued.val,
          '--drawing-icon-active': theme.iconActive.val,
          '--drawing-hover': theme.bgHover.val,
          '--drawing-active': theme.bgActive.val,
        } as CSSProperties
      }
    >
      <style>{toolbarCss}</style>
      <div
        style={{ display: collapsed ? 'none' : undefined }}
        className="chart-drawing-rail"
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
        <div className="chart-drawing-divider" />
        {groups.map((group) => {
          const tool =
            lastTools[group] ??
            (Object.keys(DRAWING_TOOLS) as IDrawingTool[]).find(
              (key) => DRAWING_TOOLS[key].group === group,
            ) ??
            'trend';
          return (
            <div key={group} className="chart-drawing-group">
              <ToolButton
                label={DRAWING_TOOLS[tool].label}
                icon={tool}
                disabled={disabled}
                active={
                  state.tool !== 'cursor' &&
                  DRAWING_TOOLS[state.tool].group === group
                }
                onClick={() => {
                  controller.selectTool(tool);
                  setMenu(null);
                }}
              />
              <button
                className="chart-drawing-button"
                type="button"
                title={group}
                aria-label={group}
                aria-haspopup="menu"
                aria-expanded={menu === group}
                disabled={disabled}
                onClick={() => setMenu(menu === group ? null : group)}
              >
                <DrawingIcon name="chevron" />
              </button>
            </div>
          );
        })}
        <div className="chart-drawing-divider" />
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
        <div className="chart-drawing-divider" />
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
      </div>
      <button
        type="button"
        className="chart-drawing-button chart-drawing-collapse"
        aria-label={
          collapsed ? 'Expand drawing toolbar' : 'Collapse drawing toolbar'
        }
        title={
          collapsed ? 'Expand drawing toolbar' : 'Collapse drawing toolbar'
        }
        aria-expanded={!collapsed}
        onClick={() => {
          setCollapsed(!collapsed);
          setMenu(null);
        }}
      >
        <span
          style={{
            display: 'flex',
            transform: collapsed ? undefined : 'rotate(180deg)',
          }}
        >
          <DrawingIcon name="chevron" />
        </span>
      </button>
      {menu ? (
        <div className="chart-drawing-menu" role="menu" aria-label={menu}>
          <div className="chart-drawing-menu-title">{menu}</div>
          {(Object.keys(DRAWING_TOOLS) as IDrawingTool[])
            .filter((tool) => DRAWING_TOOLS[tool].group === menu)
            .map((tool) => (
              <button
                type="button"
                key={tool}
                role="menuitemradio"
                aria-label={DRAWING_TOOLS[tool].label}
                aria-checked={state.tool === tool}
                onClick={() => {
                  controller.selectTool(tool);
                  setLastTools((current) => ({ ...current, [menu]: tool }));
                  setMenu(null);
                }}
              >
                <DrawingIcon name={tool} />
                <span>{DRAWING_TOOLS[tool].label}</span>
                <span className="chart-drawing-shortcut">
                  {shortcuts[tool]}
                </span>
              </button>
            ))}
        </div>
      ) : null}
      {propertiesVisible ? (
        <div
          ref={propertiesRef}
          className="chart-drawing-properties"
          data-testid="chart-drawing-properties"
          role="toolbar"
          aria-label="Drawing properties"
          style={propertiesPosition}
        >
          <button
            type="button"
            className="chart-drawing-button chart-drawing-drag-handle"
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
          >
            <span
              aria-hidden="true"
              style={{ display: 'flex', pointerEvents: 'none' }}
            >
              <Icon
                name="DragOutline"
                size="$4"
                style={{ color: 'currentColor' }}
              />
            </span>
          </button>
          <span className="chart-drawing-properties-label">
            {
              DRAWING_TOOLS[
                selected?.tool ??
                  (state.tool === 'cursor' ? 'trend' : state.tool)
              ].label
            }
          </span>
          <input
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
              <button
                type="button"
                className="chart-drawing-button"
                style={{ width: 'auto', padding: '0 5px', fontSize: 12 }}
                onClick={controller.toggleCoordinates}
              >
                Settings
              </button>
              <ToolButton
                label={selected.locked ? 'Unlock drawing' : 'Lock drawing'}
                icon={selected.locked ? 'lock' : 'unlock'}
                active={selected.locked}
                disabled={state.locked}
                onClick={controller.toggleSelectedLock}
              />
              <ToolButton
                label="Delete drawing"
                icon="delete"
                disabled={styleDisabled}
                onClick={controller.removeSelected}
              />
            </>
          ) : null}
        </div>
      ) : null}
      {selected && settingsVisible ? (
        <div
          ref={coordinatesRef}
          className={`chart-drawing-coordinates${hasText ? ' chart-drawing-text-settings' : ''}`}
          data-testid="chart-drawing-settings"
          role="dialog"
          aria-label="Drawing settings"
        >
          <strong>{DRAWING_TOOLS[selected.tool].label}</strong>
          <div className="chart-drawing-settings-body">
            {selected.tool === 'text' || selected.tool === 'callout' ? (
              <label className="chart-drawing-text-content">
                Content
                <textarea
                  aria-label="Drawing text"
                  data-testid="chart-drawing-text"
                  key={`${selected.id}-text-${selected.text ?? ''}`}
                  maxLength={500}
                  defaultValue={selected.text ?? 'Text'}
                  disabled={styleDisabled}
                  onBlur={(event) =>
                    controller.changeStyle({ text: event.target.value })
                  }
                />
              </label>
            ) : null}
            {hasText ? (
              <>
                <div className="chart-drawing-text-appearance">
                  <label>
                    Text color
                    <input
                      type="color"
                      aria-label="Text color"
                      value={style.color}
                      disabled={styleDisabled}
                      onChange={(event) =>
                        controller.changeStyle({ color: event.target.value })
                      }
                    />
                  </label>
                  <label htmlFor={fontSizeControlId}>
                    Font size
                    <FontSizeSelect
                      id={fontSizeControlId}
                      value={style.fontSize}
                      disabled={styleDisabled}
                      onChange={(fontSize) =>
                        controller.changeStyle({ fontSize })
                      }
                    />
                  </label>
                </div>
              </>
            ) : null}
            {activeTool === 'callout' ? (
              <div className="chart-drawing-text-position">
                <div style={{ marginBottom: 8, fontWeight: 600 }}>
                  Connection line
                </div>
                <LineStyleControls
                  style={style}
                  disabled={styleDisabled}
                  onChange={controller.changeStyle}
                />
              </div>
            ) : null}
            {hasText ? (
              <details className="chart-drawing-text-position">
                <summary>Position</summary>
                {pointFields}
              </details>
            ) : (
              pointFields
            )}
          </div>
          <button
            className="chart-drawing-settings-done"
            type="button"
            onClick={controller.toggleCoordinates}
            style={{
              color: 'inherit',
              background: 'transparent',
              border: '1px solid var(--drawing-border)',
              borderRadius: 4,
              padding: '5px 12px',
              marginTop: 6,
            }}
          >
            Done
          </button>
        </div>
      ) : null}
      {state.saveFailed ||
      state.history.present.length >= MAX_DRAWINGS ||
      state.tool !== 'cursor' ? (
        <div className="chart-drawing-hint" role="status">
          {hint}
        </div>
      ) : null}
    </div>
  );
}
