import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

import { useTheme } from '@onekeyhq/components';

import { TRADING_VIEW_DRAWING_ICONS } from './icons';
import { DRAWING_TOOLS, MAX_DRAWINGS, isFreehandTool } from './model';

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

export function DrawingIcon({
  name,
}: {
  name: keyof typeof TRADING_VIEW_DRAWING_ICONS;
}) {
  const url = `url("data:image/svg+xml,${encodeURIComponent(TRADING_VIEW_DRAWING_ICONS[name])}")`;
  return (
    <span
      aria-hidden="true"
      className="chart-drawing-icon"
      style={{
        display: 'inline-block',
        width: name === 'chevron' ? 6 : 28,
        height: name === 'chevron' ? 12 : 28,
        backgroundColor: 'currentColor',
        maskImage: url,
        WebkitMaskImage: url,
        maskSize: 'contain',
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
      }}
    />
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

const toolbarCss = `
.chart-drawing-toolbar { width:48px; flex-shrink:0; display:flex; flex-direction:column; border-right:1px solid var(--drawing-border); padding:2px 0; box-sizing:border-box; background:var(--drawing-bg); color:var(--drawing-text); z-index:4; }
.chart-drawing-toolbar[data-collapsed=true] { width:18px; }
.chart-drawing-collapse { width:100%; height:22px; flex-shrink:0; }
.chart-drawing-rail { flex:1; min-height:0; overflow-y:auto; scrollbar-width:none; display:flex; flex-direction:column; align-items:center; gap:0; }
.chart-drawing-button { display:flex; align-items:center; justify-content:center; flex-shrink:0; width:36px; height:28px; border:0; border-radius:5px; background:transparent; color:inherit; cursor:pointer; padding:0; }
.chart-drawing-button:hover:not(:disabled), .chart-drawing-menu button:hover { background:var(--drawing-hover); }
.chart-drawing-button:focus-visible, .chart-drawing-menu button:focus-visible { outline:2px solid #2962ff; outline-offset:-2px; }
.chart-drawing-button[aria-pressed=true] { color:#2962ff; background:var(--drawing-active); }
.chart-drawing-button:disabled { opacity:.3; cursor:default; }
.chart-drawing-divider { width:28px; height:1px; background:var(--drawing-border); margin:3px 0; flex-shrink:0; }
.chart-drawing-group { display:flex; align-items:center; }
.chart-drawing-group > .chart-drawing-button:first-child { width:28px; }
.chart-drawing-group > .chart-drawing-button:last-child { width:14px; }
.chart-drawing-group > .chart-drawing-button:last-child .chart-drawing-icon { width:10px; }
.chart-drawing-menu { position:absolute; left:52px; top:8px; width:232px; max-height:calc(100% - 16px); overflow-y:auto; background:var(--drawing-bg); border:1px solid var(--drawing-border); border-radius:8px; box-shadow:0 6px 24px #0002; padding:6px; z-index:10; }
.chart-drawing-menu-title { padding:9px 10px; font-size:11px; font-weight:600; color:var(--drawing-muted); text-transform:uppercase; letter-spacing:.8px; }
.chart-drawing-menu button { display:flex; align-items:center; gap:14px; width:100%; height:38px; padding:0 10px; border:0; border-radius:4px; background:transparent; color:inherit; font:inherit; font-size:13px; cursor:pointer; text-align:left; }
.chart-drawing-menu button[aria-checked=true] { color:#2962ff; background:var(--drawing-active); }
.chart-drawing-properties { position:absolute; top:8px; left:62px; display:flex; align-items:center; gap:6px; max-width:calc(100% - 136px); min-height:38px; padding:3px 6px; background:var(--drawing-bg); color:var(--drawing-text); border:1px solid var(--drawing-border); border-radius:7px; box-shadow:0 3px 12px #0001; z-index:3; }
.chart-drawing-properties select, .chart-drawing-properties input { background:var(--drawing-bg); color:var(--drawing-text); border:1px solid var(--drawing-border); border-radius:4px; height:27px; font:inherit; font-size:12px; }
.chart-drawing-properties input[type=color] { width:28px; padding:2px; cursor:pointer; }
.chart-drawing-properties .chart-drawing-button { width:28px; height:28px; }
.chart-drawing-properties-label { font-size:12px; margin:0 4px; white-space:nowrap; }
.chart-drawing-coordinates { position:absolute; top:52px; left:62px; max-height:calc(100% - 90px); overflow:auto; background:var(--drawing-bg); border:1px solid var(--drawing-border); border-radius:7px; padding:12px; box-shadow:0 3px 12px #0001; z-index:4; font-size:12px; }
.chart-drawing-coordinates label { display:flex; align-items:center; gap:8px; margin:6px 0; }
.chart-drawing-coordinates input { width:180px; background:var(--drawing-bg); color:var(--drawing-text); border:1px solid var(--drawing-border); padding:5px; border-radius:4px; }
.chart-drawing-shortcut { margin-left:auto; color:var(--drawing-muted); font-size:10px; }
.chart-drawing-hint { position:absolute; left:62px; bottom:32px; padding:5px 9px; border-radius:4px; background:var(--drawing-bg); color:var(--drawing-muted); font-size:11px; pointer-events:none; z-index:2; }
`;

export function DrawingToolbar({
  controller,
}: {
  controller: IChartDrawingsController;
}) {
  const theme = useTheme();
  const rootRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [menu, setMenu] = useState<string | null>(null);
  const [lastTools, setLastTools] = useState<Record<string, IDrawingTool>>({
    Lines: 'trend',
  });
  const { state } = controller;
  const selected = state.history.present.find(
    (drawing) => drawing.id === state.selectedId,
  );
  const style = selected ?? state.style;
  const groups = [
    ...new Set(Object.values(DRAWING_TOOLS).map((tool) => tool.group)),
  ];
  const disabled = !state.ready;
  const styleDisabled = Boolean(selected && (selected.locked || state.locked));
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
      {!menu && !state.hidden && (selected || state.tool !== 'cursor') ? (
        <div
          className="chart-drawing-properties"
          role="toolbar"
          aria-label="Drawing properties"
        >
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
          <select
            aria-label="Line width"
            value={style.width}
            disabled={styleDisabled}
            onChange={(event) =>
              controller.changeStyle({ width: Number(event.target.value) })
            }
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
            disabled={styleDisabled}
            onChange={(event) =>
              controller.changeStyle({
                dash: event.target.value as IDrawingStyle['dash'],
              })
            }
          >
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
          </select>
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
      {selected && state.editingCoordinates && !state.hidden && !menu ? (
        <div
          className="chart-drawing-coordinates"
          role="dialog"
          aria-label="Drawing settings"
        >
          <strong>{DRAWING_TOOLS[selected.tool].label}</strong>
          {selected.tool === 'text' || selected.tool === 'callout' ? (
            <label>
              Text
              <input
                aria-label="Drawing text"
                key={`${selected.id}-text`}
                type="text"
                maxLength={500}
                defaultValue={selected.text ?? 'Text'}
                disabled={styleDisabled}
                onBlur={(event) =>
                  controller.changeStyle({ text: event.target.value })
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }}
              />
            </label>
          ) : null}
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
          <button
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
