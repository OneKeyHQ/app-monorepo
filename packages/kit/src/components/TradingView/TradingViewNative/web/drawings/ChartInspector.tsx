import type { CSSProperties } from 'react';

import { useTheme } from '@onekeyhq/components';

import { DrawingIcon } from './DrawingToolbar';
import { DRAWING_TOOLS } from './model';

import type { IChartDrawingsController } from './useChartDrawings';

const inspectorCss = `
.chart-inspector { display:flex; flex-shrink:0; min-height:0; background:var(--inspector-bg); color:var(--inspector-text); border-left:1px solid var(--inspector-border); font-size:12px; }
.chart-inspector button { display:flex; align-items:center; justify-content:center; flex-shrink:0; background:transparent; color:inherit; border:0; padding:2px; border-radius:4px; cursor:pointer; font:inherit; }
.chart-inspector button:hover { background:var(--inspector-hover); }
.chart-inspector button:focus-visible, .chart-inspector input:focus-visible { outline:2px solid #2962ff; outline-offset:-2px; }
.chart-inspector button:disabled { opacity:.3; cursor:default; }
.chart-inspector button[aria-pressed=true] { color:#2962ff; background:var(--inspector-active); }
.chart-inspector-rail { width:34px; display:flex; flex-direction:column; align-items:center; gap:6px; padding-top:4px; }
.chart-inspector-rail button { width:30px; height:32px; }
.chart-inspector-panel { width:264px; min-height:0; display:flex; flex-direction:column; border-right:1px solid var(--inspector-border); }
.chart-inspector-heading { display:flex; align-items:center; justify-content:space-between; min-height:40px; padding:0 12px; border-bottom:1px solid var(--inspector-border); font-size:13px; font-weight:600; }
.chart-inspector-heading button { width:24px; height:26px; }
.chart-inspector-content { overflow:auto; min-height:0; flex:1; }
.chart-object-list { list-style:none; margin:0; padding:5px 0; }
.chart-object-row { display:flex; align-items:center; min-height:38px; padding:0 5px; gap:1px; }
.chart-object-row[data-selected=true] { background:var(--inspector-active); }
.chart-object-row[data-hidden=true] > .chart-object-select { opacity:.5; }
.chart-object-row .chart-object-select { flex:1; min-width:0; justify-content:flex-start; gap:6px; text-align:left; }
.chart-object-select span:last-child { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.chart-object-row > button:not(.chart-object-select) { width:25px; height:28px; }
.chart-object-row > button:not(.chart-object-select) .chart-drawing-icon { width:22px !important; height:22px !important; }
.chart-object-details { padding:10px; border-top:1px solid var(--inspector-border); }
.chart-object-details label { display:flex; align-items:center; gap:8px; }
.chart-object-details input { width:100%; min-width:0; color:inherit; background:var(--inspector-bg); border:1px solid var(--inspector-border); border-radius:4px; padding:6px; font:inherit; }
.chart-object-order { display:flex; gap:8px; margin-top:8px; }
.chart-object-order button { flex:1; gap:8px; padding:6px; border:1px solid var(--inspector-border); }
.chart-data-section { padding:10px 12px; border-bottom:1px solid var(--inspector-border); }
.chart-data-section h4 { margin:0 0 8px; font-size:12px; font-weight:600; }
.chart-data-section dl { margin:0; }
.chart-data-row { display:flex; justify-content:space-between; gap:12px; line-height:25px; }
.chart-data-row dt { color:var(--inspector-muted); }
.chart-data-row dd { margin:0; font-variant-numeric:tabular-nums; text-align:right; overflow-wrap:anywhere; }
.chart-inspector-empty { padding:20px 14px; color:var(--inspector-muted); line-height:20px; }
`;

export function ChartInspector({
  controller,
}: {
  controller: IChartDrawingsController;
}) {
  const theme = useTheme();
  const { state } = controller;
  const selected = state.history.present.find(
    (drawing) => drawing.id === state.selectedId,
  );
  const selectedIndex = state.history.present.findIndex(
    (drawing) => drawing.id === state.selectedId,
  );
  const data = state.data;
  const date = data ? new Date(data.time * 1000).toISOString() : null;
  return (
    <div
      className="chart-inspector"
      style={
        {
          '--inspector-bg': theme.bg.val,
          '--inspector-text': theme.text.val,
          '--inspector-muted': theme.textSubdued.val,
          '--inspector-border': theme.borderSubdued.val,
          '--inspector-hover': theme.bgHover.val,
          '--inspector-active': theme.bgActive.val,
        } as CSSProperties
      }
    >
      <style>{inspectorCss}</style>
      {state.panel ? (
        <section
          className="chart-inspector-panel"
          aria-label={
            state.panel === 'objects'
              ? 'Object Tree panel'
              : 'Data Window panel'
          }
        >
          <div className="chart-inspector-heading">
            <span>
              {state.panel === 'objects' ? 'Object Tree' : 'Data Window'}
            </span>
            <button
              type="button"
              aria-label="Collapse chart panel"
              title="Collapse"
              onClick={() => controller.togglePanel(state.panel ?? 'objects')}
            >
              <DrawingIcon name="chevron" />
            </button>
          </div>
          <div className="chart-inspector-content">
            {state.panel === 'objects' ? (
              <ul className="chart-object-list" aria-label="Drawing objects">
                {[...state.history.present].toReversed().map((drawing) => {
                  const label =
                    drawing.name || DRAWING_TOOLS[drawing.tool].label;
                  return (
                    <li
                      key={drawing.id}
                      className="chart-object-row"
                      data-testid="chart-object"
                      data-object-id={drawing.id}
                      data-selected={state.selectedIds.includes(drawing.id)}
                      data-hidden={drawing.hidden || state.hidden}
                    >
                      <button
                        type="button"
                        className="chart-object-select"
                        title={label}
                        aria-label={`Select ${label}`}
                        aria-pressed={state.selectedIds.includes(drawing.id)}
                        onClick={(event) =>
                          controller.selectDrawing(
                            drawing.id,
                            event.ctrlKey || event.metaKey,
                          )
                        }
                      >
                        <DrawingIcon name={drawing.tool} />
                        <span>{label}</span>
                      </button>
                      <button
                        type="button"
                        title={drawing.hidden ? 'Show' : 'Hide'}
                        aria-label={`${drawing.hidden ? 'Show' : 'Hide'} ${label}`}
                        onClick={() =>
                          controller.updateDrawing(drawing.id, {
                            hidden: !drawing.hidden,
                          })
                        }
                      >
                        <DrawingIcon name={drawing.hidden ? 'show' : 'hide'} />
                      </button>
                      <button
                        type="button"
                        title={drawing.locked ? 'Unlock' : 'Lock'}
                        aria-label={`${drawing.locked ? 'Unlock' : 'Lock'} ${label}`}
                        disabled={state.locked}
                        onClick={() =>
                          controller.updateDrawing(drawing.id, {
                            locked: !drawing.locked,
                          })
                        }
                      >
                        <DrawingIcon
                          name={drawing.locked ? 'lock' : 'unlock'}
                        />
                      </button>
                      <button
                        type="button"
                        title="Delete"
                        aria-label={`Delete ${label}`}
                        disabled={drawing.locked || state.locked}
                        onClick={() => controller.removeDrawing(drawing.id)}
                      >
                        <DrawingIcon name="delete" />
                      </button>
                    </li>
                  );
                })}
                {!state.history.present.length ? (
                  <li className="chart-inspector-empty">
                    Drawings on this chart will appear here.
                  </li>
                ) : null}
              </ul>
            ) : null}
            {state.panel === 'data' && data ? (
              <>
                <div className="chart-data-section">
                  <h4>{data.historical ? 'Selected bar' : 'Latest bar'}</h4>
                  <dl>
                    <div className="chart-data-row">
                      <dt>Date</dt>
                      <dd data-testid="chart-data-date">
                        {date?.slice(0, 10)}
                      </dd>
                    </div>
                    <div className="chart-data-row">
                      <dt>Time (UTC)</dt>
                      <dd data-testid="chart-data-time">
                        {date?.slice(11, 19)}
                      </dd>
                    </div>
                  </dl>
                </div>
                {data.groups.map((group, index) => (
                  <div
                    className="chart-data-section"
                    key={`${group.name}-${index}`}
                  >
                    <h4>{group.name}</h4>
                    <dl>
                      {group.rows.map((row) => (
                        <div className="chart-data-row" key={row.name}>
                          <dt>{row.name}</dt>
                          <dd
                            data-testid={`chart-data-${row.name}`}
                            title={String(row.value ?? '')}
                          >
                            {row.value !== null && Number.isFinite(row.value)
                              ? row.value.toLocaleString('en-US', {
                                  maximumSignificantDigits: 10,
                                })
                              : '—'}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </>
            ) : null}
            {state.panel === 'data' && !data ? (
              <div className="chart-inspector-empty">
                Waiting for chart data…
              </div>
            ) : null}
          </div>
          {state.panel === 'objects' && selected ? (
            <div className="chart-object-details">
              <label>
                Name
                <input
                  aria-label="Object name"
                  key={`${selected.id}-${selected.name ?? ''}`}
                  maxLength={100}
                  defaultValue={
                    selected.name ?? DRAWING_TOOLS[selected.tool].label
                  }
                  disabled={selected.locked || state.locked}
                  onBlur={(event) => {
                    const name = event.target.value.trim();
                    if (name !== selected.name)
                      controller.updateDrawing(selected.id, { name });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur();
                  }}
                />
              </label>
              <div className="chart-object-order">
                <button
                  type="button"
                  aria-label="Bring drawing forward"
                  disabled={
                    selected.locked ||
                    state.locked ||
                    selectedIndex === state.history.present.length - 1
                  }
                  onClick={() => controller.reorderDrawing(selected.id, 1)}
                >
                  Bring forward
                </button>
                <button
                  type="button"
                  aria-label="Send drawing backward"
                  disabled={
                    selected.locked || state.locked || selectedIndex === 0
                  }
                  onClick={() => controller.reorderDrawing(selected.id, -1)}
                >
                  Send backward
                </button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
      <div
        className="chart-inspector-rail"
        role="toolbar"
        aria-label="Chart panels"
        aria-orientation="vertical"
      >
        <button
          type="button"
          aria-label="Object Tree"
          title="Object Tree"
          aria-pressed={state.panel === 'objects'}
          onClick={() => controller.togglePanel('objects')}
        >
          <DrawingIcon name="objects" />
        </button>
        <button
          type="button"
          aria-label="Data Window"
          title="Data Window"
          aria-pressed={state.panel === 'data'}
          onClick={() => controller.togglePanel('data')}
        >
          <DrawingIcon name="data" />
        </button>
      </div>
    </div>
  );
}
