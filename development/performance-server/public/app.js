const state = {
  sessions: [],
  currentSessionId: null,
  sessionData: null,
  analysis: null,
  slowFunctions: {
    page: 1,
    pageSize: 50,
    total: 0,
    totalPages: 1,
    items: [],
  },
  repeatedCalls: {
    mode: 'rapid',
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 1,
    items: [],
  },
  timeline: {
    minTs: 0,
    maxTs: 0,
    span: 0,
    basePxPerMs: 1,
    zoom: 1,
    userAdjusted: false,
  },
  selection: null,
  timelineAvailableModules: [],
  timelineSelectedModules: null,
};

const palette = [
  '#60a5fa',
  '#f97316',
  '#22d3ee',
  '#a78bfa',
  '#34d399',
  '#f472b6',
  '#facc15',
  '#38bdf8',
  '#f87171',
  '#c084fc',
  '#fb7185',
];

function getColorForModule(module) {
  if (!module) return palette[0];
  let hash = 0;
  for (let i = 0; i < module.length; i += 1) {
    hash = (hash * 31 + module.charCodeAt(i)) % palette.length;
  }
  return palette[Math.abs(hash) % palette.length];
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res.json();
}

function normalizePath(p) {
  return typeof p === 'string' ? p.replace(/\\/g, '/') : '';
}

function deriveModuleFromPath(filePath) {
  if (!filePath) return 'unknown';
  const normalized = normalizePath(filePath);
  const parts = normalized.split('/').filter(Boolean);
  const pkgIdx = parts.indexOf('packages');
  if (pkgIdx >= 0 && parts[pkgIdx + 1]) {
    const pkg = parts[pkgIdx + 1];
    const scope = parts[pkgIdx + 2];
    if (scope && scope !== 'src') {
      return `${pkg}/${scope}`;
    }
    const afterSrc = parts[pkgIdx + 3];
    return afterSrc ? `${pkg}/${afterSrc}` : pkg;
  }
  return parts.slice(0, 2).join('/') || normalized;
}

function pickTimestamp(event, payload) {
  const candidate =
    payload?.absoluteTime ??
    event?.absoluteTime ??
    payload?.timestamp ??
    event?.timestamp ??
    payload?.time ??
    event?.time ??
    payload?.ts ??
    event?.ts;
  const num = Number(candidate);
  return Number.isFinite(num) ? num : 0;
}

function formatNumber(num) {
  return num.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatMs(ms) {
  if (!Number.isFinite(ms)) return '-';
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
  return `${ms.toFixed(1)} ms`;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '-';
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function downsampleSorted(points, maxPoints = 800) {
  if (!points || points.length <= maxPoints) return points || [];
  const step = Math.ceil(points.length / maxPoints);
  const sampled = [];
  for (let i = 0; i < points.length; i += step) {
    sampled.push(points[i]);
  }
  const last = points[points.length - 1];
  if (sampled[sampled.length - 1] !== last) {
    sampled.push(last);
  }
  return sampled;
}

function setStatus(text) {
  const btn = document.getElementById('reloadSession');
  if (btn) {
    btn.textContent = text;
  }
}

function renderSessionOptions() {
  const select = document.getElementById('sessionSelect');
  select.innerHTML = '';
  if (!state.sessions.length) {
    select.innerHTML = '<option value="">No sessions</option>';
    return;
  }
  state.sessions.forEach((s) => {
    const opt = document.createElement('option');
    opt.value = s.sessionId;
    const activeMark = s.active ? ' • live' : '';
    opt.textContent = `${s.sessionId} (${
      s.platform || 'unknown'
    })${activeMark}`;
    select.appendChild(opt);
  });
  if (state.currentSessionId) {
    select.value = state.currentSessionId;
  } else {
    state.currentSessionId = state.sessions[0].sessionId;
    select.value = state.currentSessionId;
  }
}

function renderMeta() {
  const meta = state.sessionData?.meta || state.analysis?.meta || {};
  const eventCounts = meta.eventCounts || {};
  document.getElementById('metaPlatform').textContent = meta.platform || '-';
  document.getElementById('metaStart').textContent = meta.startTime
    ? new Date(meta.startTime).toLocaleString()
    : '-';
  document.getElementById('metaEvents').textContent = formatNumber(
    Object.values(eventCounts).reduce((a, b) => a + b, 0) || 0,
  );
  document.getElementById('metaFunctions').textContent = formatNumber(
    state.analysis?.analysis?.summary?.totalCalls || 0,
  );
}

function buildPoints(list, accessorX, accessorY) {
  return list
    .map((item) => ({
      x: Number(accessorX(item)),
      y: Number(accessorY(item)),
    }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    .toSorted((a, b) => a.x - b.x);
}

function renderSparkline(containerId, points, color, formatter) {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!points.length) {
    container.innerHTML = '<div class="text-sm text-slate-500">No data</div>';
    return;
  }
  const width = container.clientWidth || 600;
  const height = 110;
  const minX = points[0].x;
  const maxX = points[points.length - 1].x;
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);

  const path = points
    .map((p, idx) => {
      const x = ((p.x - minX) / spanX) * width;
      const y = height - ((p.y - minY) / spanY) * height;
      return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');

  const last = points[points.length - 1];
  container.innerHTML = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" class="overflow-visible">
      <path d="${path}" fill="none" stroke="${color}" stroke-width="2" />
    </svg>
    <div class="mt-2 text-xs text-slate-400">${
      formatter ? formatter(last.y) : last.y
    }</div>
  `;
}

function renderMemory() {
  const memory = state.sessionData?.events?.memory || [];
  const points = buildPoints(
    memory,
    (e) => e.timestamp ?? e.absoluteTime ?? e.data?.timestamp ?? 0,
    (e) => {
      // Support multiple memory formats:
      // - Web/Desktop: heapUsed, heapTotal
      // - iOS/Android: rss (resident set size)
      return e.data?.heapUsed ?? e.heapUsed ?? e.data?.rss ?? e.rss ?? e.data;
    },
  );
  renderSparkline('memorySparkline', points, '#60a5fa', formatBytes);
  document.getElementById('memorySummary').textContent = points.length
    ? `${formatBytes(points[points.length - 1].y)} (latest)`
    : '-';
  document.getElementById('memoryCount').textContent = `${points.length} pts`;
}

function renderFps() {
  const fps = state.sessionData?.events?.fps || [];
  const points = buildPoints(
    fps,
    (e) => e.timestamp ?? e.absoluteTime ?? e.data?.timestamp ?? 0,
    (e) => e.data?.fps ?? e.fps ?? 0,
  );
  renderSparkline(
    'fpsSparkline',
    points,
    '#f97316',
    (v) => `${v.toFixed(0)} fps`,
  );
  document.getElementById('fpsSummary').textContent = points.length
    ? `${points[points.length - 1].y.toFixed(0)} fps (latest)`
    : '-';
  document.getElementById('fpsCount').textContent = `${points.length} pts`;
}

function buildFunctionEvents() {
  const functionEvents = state.sessionData?.events?.function_call || [];
  return functionEvents
    .map((e) => {
      const payload = e.data || e;
      const endTs = pickTimestamp(e, payload);
      const dur = Number(payload.duration || 0);
      const startTs = Math.max(0, endTs - dur);
      return {
        type: 'function',
        name: payload.name || 'unknown',
        module: payload.module || 'unknown',
        duration: dur,
        start: startTs,
        end: endTs,
        file: normalizePath(payload.file || ''),
        line: payload.line || 0,
        stack: Array.isArray(payload.stack) ? payload.stack : [],
      };
    })
    .filter((e) => e.duration > 0)
    .toSorted((a, b) => a.start - b.start);
}

function buildModuleLoadEvents() {
  const moduleLoads = state.sessionData?.events?.module_load || [];
  return moduleLoads
    .map((e) => {
      const payload = e.data || e;
      const ts = pickTimestamp(e, payload);
      const duration = Math.max(Number(payload.duration || 0), 0);
      const path = normalizePath(payload.path || payload.module || 'unknown');
      return {
        type: 'module',
        path,
        module: deriveModuleFromPath(path),
        duration,
        start: ts,
        end: ts + duration,
      };
    })
    .filter((e) => Number.isFinite(e.start))
    .toSorted((a, b) => a.start - b.start);
}

function buildMarkEvents() {
  const marks = state.sessionData?.events?.mark || [];
  return marks
    .map((e) => {
      const payload = e.data || e;
      const ts = pickTimestamp(e, payload);
      const name = payload?.name || payload?.label || 'mark';
      return {
        type: 'mark',
        name,
        detail: payload?.detail,
        start: ts,
        end: ts,
        duration: 0,
        raw: e,
      };
    })
    .filter((e) => Number.isFinite(e.start) && e.start >= 0)
    .toSorted((a, b) => a.start - b.start);
}

function buildMemorySamples() {
  const memory = state.sessionData?.events?.memory || [];
  return memory
    .map((e) => {
      const ts = pickTimestamp(e, e.data || e);
      const value = Number(
        e.data?.heapUsed ?? e.heapUsed ?? e.data?.rss ?? e.rss ?? e.data,
      );
      return { ts, value, raw: e };
    })
    .filter(
      (p) => Number.isFinite(p.ts) && p.ts > 0 && Number.isFinite(p.value),
    )
    .toSorted((a, b) => a.ts - b.ts);
}

function buildFpsSamples() {
  const fps = state.sessionData?.events?.fps || [];
  return fps
    .map((e) => {
      const ts = pickTimestamp(e, e.data || e);
      const value = Number(e.data?.fps ?? e.fps ?? 0);
      return { ts, value, raw: e };
    })
    .filter(
      (p) => Number.isFinite(p.ts) && p.ts > 0 && Number.isFinite(p.value),
    )
    .toSorted((a, b) => a.ts - b.ts);
}

function buildMetricTimestampEvents() {
  const make = (samples) =>
    samples.map((s) => ({
      type: 'metric',
      start: s.ts,
      end: s.ts,
      duration: 0,
    }));
  return [...make(buildMemorySamples()), ...make(buildFpsSamples())];
}

function renderMetricTrack(trackEl, samples, opts) {
  if (!trackEl) return;
  trackEl.innerHTML = '';
  if (!samples.length) {
    trackEl.innerHTML =
      '<div class="text-xs text-slate-500 px-2 pt-2">No data</div>';
    return;
  }

  const { minTs, pxPerMs, trackWidth } = opts;
  const height = 72;
  const pad = 10;
  trackEl.style.width = `${trackWidth}px`;
  trackEl.style.height = `${height}px`;

  const points = downsampleSorted(samples, 800);
  const minY = Math.min(...points.map((p) => p.value));
  const maxY = Math.max(...points.map((p) => p.value));
  const spanY = Math.max(maxY - minY, 1);

  const scaled = points
    .map((p) => {
      const x = Math.max(0, (p.ts - minTs) * pxPerMs);
      const y = height - pad - ((p.value - minY) / spanY) * (height - pad * 2);
      return { x, y, value: p.value, ts: p.ts };
    })
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    .toSorted((a, b) => a.x - b.x);

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(trackWidth));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `0 0 ${trackWidth} ${height}`);

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', opts.color);
  path.setAttribute('stroke-width', '2');
  path.setAttribute('stroke-linejoin', 'round');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('opacity', '0.9');

  let d = '';
  scaled.forEach((p, idx) => {
    d += `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)} `;
  });
  path.setAttribute('d', d.trim());
  svg.appendChild(path);

  const shouldShowDots = scaled.length <= 250;
  if (shouldShowDots) {
    scaled.forEach((p) => {
      const dot = document.createElementNS(
        'http://www.w3.org/2000/svg',
        'circle',
      );
      dot.setAttribute('cx', p.x.toFixed(2));
      dot.setAttribute('cy', p.y.toFixed(2));
      dot.setAttribute('r', '2.5');
      dot.setAttribute('fill', opts.color);
      dot.setAttribute('opacity', '0.95');

      svg.appendChild(dot);
    });
  }

  trackEl.appendChild(svg);

  const cursor = document.createElement('div');
  cursor.className = 'metric-cursor';
  cursor.style.display = 'none';
  trackEl.appendChild(cursor);

  const tooltip = document.createElement('div');
  tooltip.className = 'metric-tooltip hidden';
  trackEl.appendChild(tooltip);

  function findNearestByX(x) {
    if (!scaled.length) return null;
    let lo = 0;
    let hi = scaled.length - 1;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (scaled[mid].x < x) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    let idx = lo;
    if (
      idx > 0 &&
      Math.abs(scaled[idx - 1].x - x) < Math.abs(scaled[idx].x - x)
    ) {
      idx -= 1;
    }
    return scaled[idx];
  }

  trackEl.onmousemove = (e) => {
    const rect = trackEl.getBoundingClientRect();
    const localX = e.clientX - rect.left;
    const nearest = findNearestByX(localX);
    if (!nearest) return;

    cursor.style.display = 'block';
    cursor.style.left = `${nearest.x}px`;

    tooltip.classList.remove('hidden');
    tooltip.style.left = `${nearest.x}px`;
    tooltip.style.top = `${Math.max(4, nearest.y - 28)}px`;
    tooltip.textContent = `${opts.formatValue(nearest.value)} @ ${formatMs(
      nearest.ts - minTs,
    )}`;
  };
  trackEl.onmouseleave = () => {
    cursor.style.display = 'none';
    tooltip.classList.add('hidden');
  };
}

function computeTimeline(events) {
  if (!events.length) {
    state.timeline = {
      minTs: 0,
      maxTs: 0,
      span: 0,
      basePxPerMs: 1,
      zoom: 1,
      userAdjusted: false,
    };
    return;
  }
  const minTs = Math.min(...events.map((e) => e.start));
  const maxTs = Math.max(...events.map((e) => e.end ?? e.start + e.duration));
  const span = Math.max(maxTs - minTs, 1);
  const basePxPerMs = 1200 / span;
  const shouldKeepZoom =
    state.timeline &&
    state.timeline.span > 0 &&
    state.timeline.minTs === minTs &&
    state.timeline.maxTs === maxTs;
  const zoom = shouldKeepZoom ? state.timeline.zoom : 1;
  const userAdjusted = shouldKeepZoom ? state.timeline.userAdjusted : false;
  state.timeline = {
    minTs,
    maxTs,
    span,
    basePxPerMs,
    zoom,
    userAdjusted,
  };
}

function renderAxis(minTs, maxTs, pxPerMs, trackWidth) {
  const axis = document.getElementById('timelineAxis');
  axis.innerHTML = '';
  axis.style.width = `${trackWidth}px`;
  const span = maxTs - minTs;
  if (span <= 0) return;
  const niceStep = span / 8;
  const rawStep = niceStep < 1000 ? 500 : Math.round(niceStep / 1000) * 1000;
  const step = rawStep || 1000;
  for (let t = minTs; t <= maxTs + 1; t += step) {
    const left = (t - minTs) * pxPerMs;
    const tick = document.createElement('div');
    tick.className = 'tick';
    tick.style.left = `${left}px`;
    tick.textContent = formatMs(t - minTs);
    axis.appendChild(tick);

    const grid = document.createElement('div');
    grid.className = 'grid-line';
    grid.style.left = `${left}px`;
    grid.style.height = '100%';
    axis.appendChild(grid);
  }
}

function renderModuleLegend(modules) {
  const legend = document.getElementById('moduleLegend');
  legend.innerHTML = '';
  const countEl = document.getElementById('moduleSelectedCount');
  if (!state.timelineSelectedModules) {
    state.timelineSelectedModules = new Set(modules);
  }
  const selected = state.timelineSelectedModules;
  if (countEl) {
    countEl.textContent = `${selected.size}/${modules.length}`;
  }
  modules.forEach((m) => {
    const item = document.createElement('label');
    item.className =
      'flex items-center gap-2 px-2 py-1 rounded border border-dark-border hover:bg-dark-hover cursor-pointer select-none';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = selected.has(m);
    checkbox.className = 'accent-indigo-500';
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        selected.add(m);
      } else {
        selected.delete(m);
      }
      renderTimeline();
    });

    const swatch = document.createElement('span');
    swatch.className = 'inline-block w-3 h-3 rounded';
    swatch.style.background = getColorForModule(m);

    const label = document.createElement('span');
    label.textContent = m;
    if (!selected.has(m)) {
      label.className = 'text-slate-500';
    }

    item.appendChild(checkbox);
    item.appendChild(swatch);
    item.appendChild(label);
    legend.appendChild(item);
  });
}

function renderModuleLoadLegend(modules) {
  const legend = document.getElementById('moduleLoadLegend');
  if (!legend) return;
  legend.innerHTML = '';
  const limited = modules.slice(0, 40);
  limited.forEach((m) => {
    const item = document.createElement('div');
    item.className =
      'flex items-center gap-2 px-2 py-1 rounded border border-dark-border';
    const swatch = document.createElement('span');
    swatch.className = 'inline-block w-3 h-3 rounded';
    swatch.style.background = getColorForModule(m);
    const label = document.createElement('span');
    label.textContent = m;
    item.appendChild(swatch);
    item.appendChild(label);
    legend.appendChild(item);
  });
  if (modules.length > limited.length) {
    const more = document.createElement('div');
    more.className = 'text-xs text-slate-500';
    more.textContent = `+${modules.length - limited.length} more`;
    legend.appendChild(more);
  }
}

function renderTimeline() {
  const track = document.getElementById('functionTrack');
  const moduleTrack = document.getElementById('moduleTrack');
  const markTrack = document.getElementById('markTrack');
  const memoryTrack = document.getElementById('memoryTrack');
  const fpsTrack = document.getElementById('fpsTrack');
  const wrapper = document.getElementById('functionTrackWrapper');
  track.innerHTML = '';
  if (moduleTrack) {
    moduleTrack.innerHTML = '';
  }
  if (markTrack) {
    markTrack.innerHTML = '';
  }
  if (memoryTrack) {
    memoryTrack.innerHTML = '';
  }
  if (fpsTrack) {
    fpsTrack.innerHTML = '';
  }
  if (!wrapper) return;
  const allFunctionEvents = buildFunctionEvents();
  const allModules = Array.from(
    new Set(allFunctionEvents.map((e) => e.module)),
  ).toSorted();
  state.timelineAvailableModules = allModules;
  if (!state.timelineSelectedModules) {
    state.timelineSelectedModules = new Set(allModules);
  }
  const selectedModules = state.timelineSelectedModules;
  const functionEvents = allFunctionEvents.filter((e) =>
    selectedModules.has(e.module),
  );
  if (
    state.selection?.type === 'function' &&
    !selectedModules.has(state.selection.module)
  ) {
    state.selection = null;
  }
  const moduleLoads = buildModuleLoadEvents();
  const markEvents = buildMarkEvents();
  const metricEvents = buildMetricTimestampEvents();
  const timelineEvents = [
    ...functionEvents,
    ...moduleLoads,
    ...markEvents,
    ...metricEvents,
  ];
  if (!timelineEvents.length) {
    track.innerHTML =
      '<div class="text-sm text-slate-500">No function calls</div>';
    if (moduleTrack) {
      moduleTrack.innerHTML =
        '<div class="text-xs text-slate-500 px-2 pt-2">No module loads</div>';
    }
    if (markTrack) {
      markTrack.innerHTML =
        '<div class="text-xs text-slate-500 px-2 pt-2">No marks</div>';
    }
    if (memoryTrack) {
      memoryTrack.innerHTML =
        '<div class="text-xs text-slate-500 px-2 pt-2">No memory data</div>';
    }
    if (fpsTrack) {
      fpsTrack.innerHTML =
        '<div class="text-xs text-slate-500 px-2 pt-2">No FPS data</div>';
    }
    document.getElementById('timelineSpan').textContent = '-';
    document.getElementById('timelineAxis').innerHTML = '';
    renderModuleLegend(allModules);
    renderModuleLoadLegend([]);
    return;
  }

  computeTimeline(timelineEvents);
  const { minTs, basePxPerMs } = state.timeline;
  let { zoom } = state.timeline;

  if (!state.timeline.userAdjusted && functionEvents.length) {
    const fnMin = Math.min(...functionEvents.map((e) => e.start));
    const fnMax = Math.max(...functionEvents.map((e) => e.start + e.duration));
    const fnSpan = Math.max(fnMax - fnMin, 1);
    const desiredZoom = Math.min(Math.max(state.timeline.span / fnSpan, 1), 30);
    state.timeline.zoom = desiredZoom;
  }
  zoom = state.timeline.zoom;

  const placed = functionEvents.map((ev) => ({
    ...ev,
    displayStart: Math.max(0, ev.start - minTs),
    displayDuration: Math.max(ev.end - ev.start, 0),
  }));

  const displaySpan = state.timeline.span;

  const pxPerMs = basePxPerMs * zoom;
  const trackWidth = Math.max(displaySpan * pxPerMs, 900);
  track.style.width = `${trackWidth}px`;
  if (moduleTrack) {
    moduleTrack.style.width = `${trackWidth}px`;
  }
  if (markTrack) {
    markTrack.style.width = `${trackWidth}px`;
  }
  if (memoryTrack) {
    memoryTrack.style.width = `${trackWidth}px`;
  }
  if (fpsTrack) {
    fpsTrack.style.width = `${trackWidth}px`;
  }

  if (!functionEvents.length) {
    track.innerHTML =
      '<div class="text-sm text-slate-500 px-2 py-2">No function calls</div>';
  }

  // Pack bars into lanes to avoid overlap, ignoring stack expansion
  const laneEnds = [];
  const laneItems = [];
  placed.forEach((ev) => {
    let laneIndex = laneEnds.findIndex((end) => ev.displayStart >= end);
    if (laneIndex === -1) {
      laneIndex = laneEnds.length;
      laneEnds.push(ev.displayStart + ev.displayDuration);
    } else {
      laneEnds[laneIndex] = ev.displayStart + ev.displayDuration;
    }
    laneItems.push({ ...ev, lane: laneIndex });
  });

  laneItems.forEach((item) => {
    const bar = document.createElement('div');
    bar.className = 'flame-bar';
    bar.style.left = `${item.displayStart * pxPerMs}px`;
    bar.style.width = `${Math.max(item.displayDuration * pxPerMs, 2)}px`;
    bar.style.top = `${item.lane * 24}px`;
    bar.style.height = '20px';
    bar.style.borderWidth = '1px';
    bar.style.background = getColorForModule(item.module);
    bar.title = `${item.name} (${item.module}) • ${formatMs(
      item.duration,
    )} @ ${formatMs(item.start - minTs)} → ${formatMs(item.end - minTs)}`;

    const label = document.createElement('span');
    label.className = 'label';
    if (item.displayDuration * pxPerMs > 40) {
      label.textContent = item.name;
    } else {
      label.textContent = '';
    }
    bar.appendChild(label);
    bar.addEventListener('click', () => {
      state.selection = { ...item, type: 'function' };
      renderSelection();
    });
    track.appendChild(bar);
  });

  const maxLane = laneEnds.length;
  const minHeight = functionEvents.length ? 0 : 60;
  track.style.height = `${Math.max(maxLane * 26 + 16, minHeight)}px`;
  document.getElementById('timelineSpan').textContent = `0 → ${formatMs(
    displaySpan,
  )}`;
  renderAxis(0, displaySpan, pxPerMs, trackWidth);
  renderModuleLegend(allModules);
  if (moduleTrack) {
    if (!moduleLoads.length) {
      moduleTrack.innerHTML =
        '<div class="text-xs text-slate-500 px-2 pt-2">No module loads</div>';
    } else {
      moduleLoads.forEach((mod) => {
        const pin = document.createElement('div');
        pin.className = 'module-pin';
        const displayStart = Math.max(0, mod.start - minTs);
        const displayEnd = Math.max(
          0,
          (mod.end ?? mod.start + mod.duration) - minTs,
        );
        pin.style.left = `${displayStart * pxPerMs}px`;
        pin.style.width = `${Math.max(
          (displayEnd - displayStart) * pxPerMs,
          3,
        )}px`;
        pin.style.background = getColorForModule(mod.module);
        pin.title = `${mod.path} • ${formatMs(mod.duration)} @ ${formatMs(
          mod.start - minTs,
        )}`;
        pin.addEventListener('click', () => {
          state.selection = { ...mod, type: 'module' };
          renderSelection();
        });
        moduleTrack.appendChild(pin);
      });
    }
  }
  renderModuleLoadLegend(Array.from(new Set(moduleLoads.map((m) => m.module))));

  if (markTrack) {
    if (!markEvents.length) {
      markTrack.innerHTML =
        '<div class="text-xs text-slate-500 px-2 pt-2">No marks</div>';
    } else {
      const shouldShowLabels = markEvents.length <= 24;
      markEvents.forEach((m) => {
        const pin = document.createElement('div');
        pin.className = 'mark-pin';
        const displayStart = Math.max(0, m.start - minTs);
        pin.style.left = `${displayStart * pxPerMs}px`;
        pin.title = `${m.name} @ ${formatMs(m.start - minTs)}`;
        pin.addEventListener('click', () => {
          state.selection = { ...m, type: 'mark' };
          renderSelection();
        });
        if (shouldShowLabels) {
          const label = document.createElement('div');
          label.className = 'mark-label';
          label.textContent = m.name;
          pin.appendChild(label);
        }
        markTrack.appendChild(pin);
      });
    }
  }

  renderMetricTrack(memoryTrack, buildMemorySamples(), {
    minTs,
    pxPerMs,
    trackWidth,
    color: '#60a5fa',
    formatValue: formatBytes,
  });
  renderMetricTrack(fpsTrack, buildFpsSamples(), {
    minTs,
    pxPerMs,
    trackWidth,
    color: '#f97316',
    formatValue: (v) => `${Math.round(v)} fps`,
  });

  renderSelection();

  wrapper.onwheel = (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const rect = wrapper.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const currentPxPerMs = state.timeline.basePxPerMs * state.timeline.zoom;
    const cursorTime = (screenX + wrapper.scrollLeft) / currentPxPerMs;
    const factor = e.deltaY < 0 ? 1.1 : 0.9;
    const newZoom = Math.min(Math.max(state.timeline.zoom * factor, 0.2), 30);
    state.timeline.zoom = newZoom;
    state.timeline.userAdjusted = true;
    const newPxPerMs = state.timeline.basePxPerMs * newZoom;
    const newTrackWidth = Math.max(state.timeline.span * newPxPerMs, 900);
    track.style.width = `${newTrackWidth}px`;
    if (moduleTrack) {
      moduleTrack.style.width = `${newTrackWidth}px`;
    }
    if (markTrack) {
      markTrack.style.width = `${newTrackWidth}px`;
    }
    if (memoryTrack) {
      memoryTrack.style.width = `${newTrackWidth}px`;
    }
    if (fpsTrack) {
      fpsTrack.style.width = `${newTrackWidth}px`;
    }
    const newScrollLeft = cursorTime * newPxPerMs - screenX;
    wrapper.scrollLeft = Math.max(newScrollLeft, 0);
    renderTimeline();
  };
}

function renderSlowFunctions() {
  const tbody = document.getElementById('slowFunctionsBody');
  const info = document.getElementById('slowFunctionsPagerInfo');
  const prevBtn = document.getElementById('slowPrev');
  const nextBtn = document.getElementById('slowNext');
  tbody.innerHTML = '';
  const list = state.slowFunctions?.items || [];
  if (!list.length) {
    tbody.innerHTML =
      '<tr><td colspan="7" class="py-3 text-center text-slate-500">No functions</td></tr>';
    if (info) info.textContent = '0 items';
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    return;
  }
  if (info) {
    info.textContent = `Page ${state.slowFunctions.page} / ${
      state.slowFunctions.totalPages
    } • ${formatNumber(state.slowFunctions.total)} items`;
  }
  if (prevBtn) prevBtn.disabled = state.slowFunctions.page <= 1;
  if (nextBtn)
    nextBtn.disabled =
      state.slowFunctions.page >= state.slowFunctions.totalPages;

  const baseIndex =
    (state.slowFunctions.page - 1) * state.slowFunctions.pageSize;
  list.forEach((f, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="py-2 pr-4 text-slate-400">${baseIndex + idx + 1}</td>
      <td class="py-2 pr-4">
        <div class="font-semibold">${f.name}</div>
        <div class="text-xs text-slate-500">${f.file}:${f.line || 0}</div>
      </td>
      <td class="py-2 pr-4">${f.module}</td>
      <td class="py-2 pr-4 text-right">${Number(f.max || 0).toFixed(1)}</td>
      <td class="py-2 pr-4 text-right">${Number(f.p95 || 0).toFixed(1)}</td>
      <td class="py-2 pr-4 text-right">${Number(f.avg || 0).toFixed(1)}</td>
      <td class="py-2 pr-4 text-right">${Number(f.count || 0)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderRepeatedCalls() {
  const tbody = document.getElementById('repeatCallsBody');
  const info = document.getElementById('repeatCallsPagerInfo');
  const prevBtn = document.getElementById('repeatPrev');
  const nextBtn = document.getElementById('repeatNext');
  const countHeader = document.getElementById('repeatCountHeader');
  tbody.innerHTML = '';
  const mode = state.repeatedCalls?.mode || 'rapid';
  if (countHeader) {
    countHeader.textContent = mode === 'overall' ? 'Calls' : 'Rapid calls';
  }
  const repeats = state.repeatedCalls?.items || [];
  if (!repeats.length) {
    tbody.innerHTML = `<tr><td colspan="4" class="py-3 text-center text-slate-500">${
      mode === 'overall'
        ? 'No repeated calls detected'
        : 'No rapid repeats detected'
    }</td></tr>`;
    if (info) info.textContent = '0 items';
    if (prevBtn) prevBtn.disabled = true;
    if (nextBtn) nextBtn.disabled = true;
    return;
  }
  if (info) {
    info.textContent = `Page ${state.repeatedCalls.page} / ${
      state.repeatedCalls.totalPages
    } • ${formatNumber(state.repeatedCalls.total)} items`;
  }
  if (prevBtn) prevBtn.disabled = state.repeatedCalls.page <= 1;
  if (nextBtn)
    nextBtn.disabled =
      state.repeatedCalls.page >= state.repeatedCalls.totalPages;
  repeats.forEach((r) => {
    const tr = document.createElement('tr');
    const count =
      mode === 'overall' ? Number(r.calls || 0) : Number(r.count || 0);
    tr.innerHTML = `
      <td class="py-2 pr-4 font-semibold">${r.name}</td>
      <td class="py-2 pr-4 text-slate-400">${
        r.file ? `${r.file}:${r.line || 0}` : ''
      }</td>
      <td class="py-2 pr-4 text-right">${count}</td>
      <td class="py-2 pr-4 text-right">${Number(r.totalDuration || 0).toFixed(
        0,
      )}</td>
    `;
    tbody.appendChild(tr);
  });
}

function populateModuleFilter() {
  const select = document.getElementById('moduleFilter');
  const modules =
    state.analysis?.modules ||
    state.analysis?.analysis?.modules?.map((m) => m.module) ||
    state.analysis?.analysis?.modules ||
    [];
  const unique = Array.from(new Set(modules));
  select.innerHTML = '<option value="all">All modules</option>';
  unique.forEach((m) => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = m;
    select.appendChild(opt);
  });
}

async function loadSession(sessionId) {
  if (!sessionId) return;
  setStatus('Loading...');
  try {
    const [sessionData, analysis] = await Promise.all([
      fetchJSON(`/api/sessions/${sessionId}`),
      fetchJSON(`/api/sessions/${sessionId}/analysis`),
    ]);
    state.currentSessionId = sessionId;
    state.sessionData = sessionData;
    state.analysis = analysis;
    state.slowFunctions.page = 1;
    state.repeatedCalls.page = 1;
    state.timelineAvailableModules = [];
    state.timelineSelectedModules = null;
    renderMeta();
    renderMemory();
    renderFps();
    renderTimeline();
    populateModuleFilter();
    await Promise.all([refreshSlowFunctions(), refreshRepeatedCalls()]);

    // Auto-load insight panels to avoid manual clicks.
    // Non-blocking: keep session load responsive.
    void autoLoadInsightPanels(sessionId);
  } catch (err) {
    alert(`Failed to load session: ${err.message}`);
  } finally {
    setStatus('Load session');
  }
}

async function loadSessions() {
  try {
    const sessions = await fetchJSON('/api/sessions');
    state.sessions = sessions || [];
    renderSessionOptions();
  } catch (err) {
    alert(`Failed to list sessions: ${err.message}`);
  }
}

async function exportSpeedscope() {
  if (!state.currentSessionId) return;
  try {
    const data = await fetchJSON(
      `/api/sessions/${state.currentSessionId}/speedscope`,
    );
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.currentSessionId}-speedscope.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert(`Failed to export speedscope: ${err.message}`);
  }
}

function downloadRaw() {
  if (!state.sessionData) return;
  const blob = new Blob([JSON.stringify(state.sessionData, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${state.currentSessionId || 'session'}-raw.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function wireEvents() {
  document
    .getElementById('refreshSessions')
    .addEventListener('click', loadSessions);
  document
    .getElementById('reloadSession')
    .addEventListener('click', () =>
      loadSession(document.getElementById('sessionSelect').value),
    );
  document.getElementById('sessionSelect').addEventListener('change', (e) => {
    const sessionId = e.target.value;
    state.currentSessionId = sessionId;
    void loadSession(sessionId);
  });
  document
    .getElementById('exportSpeedscope')
    .addEventListener('click', exportSpeedscope);
  document.getElementById('exportRaw').addEventListener('click', downloadRaw);
  document.getElementById('applyFilter').addEventListener('click', async () => {
    state.slowFunctions.page = 1;
    state.repeatedCalls.page = 1;
    await Promise.all([refreshSlowFunctions(), refreshRepeatedCalls()]);
  });

  const repeatMode = document.getElementById('repeatMode');
  if (repeatMode) {
    repeatMode.addEventListener('change', async (e) => {
      state.repeatedCalls.mode = e.target.value || 'rapid';
      state.repeatedCalls.page = 1;
      await refreshRepeatedCalls();
    });
  }

  const slowSize = document.getElementById('slowPageSize');
  if (slowSize) {
    slowSize.addEventListener('change', async (e) => {
      state.slowFunctions.pageSize = Number(e.target.value) || 50;
      state.slowFunctions.page = 1;
      await refreshSlowFunctions();
    });
  }
  const slowPrev = document.getElementById('slowPrev');
  const slowNext = document.getElementById('slowNext');
  if (slowPrev) {
    slowPrev.addEventListener('click', async () => {
      if (state.slowFunctions.page <= 1) return;
      state.slowFunctions.page -= 1;
      await refreshSlowFunctions();
    });
  }
  if (slowNext) {
    slowNext.addEventListener('click', async () => {
      if (state.slowFunctions.page >= state.slowFunctions.totalPages) return;
      state.slowFunctions.page += 1;
      await refreshSlowFunctions();
    });
  }

  const repeatSize = document.getElementById('repeatPageSize');
  if (repeatSize) {
    repeatSize.addEventListener('change', async (e) => {
      state.repeatedCalls.pageSize = Number(e.target.value) || 20;
      state.repeatedCalls.page = 1;
      await refreshRepeatedCalls();
    });
  }
  const repeatPrev = document.getElementById('repeatPrev');
  const repeatNext = document.getElementById('repeatNext');
  if (repeatPrev) {
    repeatPrev.addEventListener('click', async () => {
      if (state.repeatedCalls.page <= 1) return;
      state.repeatedCalls.page -= 1;
      await refreshRepeatedCalls();
    });
  }
  if (repeatNext) {
    repeatNext.addEventListener('click', async () => {
      if (state.repeatedCalls.page >= state.repeatedCalls.totalPages) return;
      state.repeatedCalls.page += 1;
      await refreshRepeatedCalls();
    });
  }

  const selectAll = document.getElementById('moduleSelectAll');
  const selectNone = document.getElementById('moduleSelectNone');
  if (selectAll) {
    selectAll.addEventListener('click', () => {
      state.timelineSelectedModules = new Set(
        state.timelineAvailableModules || [],
      );
      renderTimeline();
    });
  }
  if (selectNone) {
    selectNone.addEventListener('click', () => {
      state.timelineSelectedModules = new Set();
      state.selection = null;
      renderTimeline();
    });
  }

  const loadKeyMarksBtn = document.getElementById('loadKeyMarks');
  if (loadKeyMarksBtn) {
    loadKeyMarksBtn.addEventListener('click', loadKeyMarks);
  }

  const loadHomeRefreshBtn = document.getElementById('loadHomeRefresh');
  if (loadHomeRefreshBtn) {
    loadHomeRefreshBtn.addEventListener('click', loadHomeRefresh);
  }

  const loadJsBlockBtn = document.getElementById('loadJsBlock');
  if (loadJsBlockBtn) {
    loadJsBlockBtn.addEventListener('click', loadJsBlock);
  }

  const loadLowFpsBtn = document.getElementById('loadLowFps');
  if (loadLowFpsBtn) {
    loadLowFpsBtn.addEventListener('click', loadLowFps);
  }
}

async function refreshSlowFunctions() {
  if (!state.currentSessionId) return;
  const moduleFilter = document.getElementById('moduleFilter')?.value || 'all';
  const thresholdMs =
    Number(document.getElementById('durationThreshold')?.value) || 0;

  const params = new URLSearchParams();
  params.set('page', String(state.slowFunctions.page));
  params.set('pageSize', String(state.slowFunctions.pageSize));
  params.set('module', moduleFilter || 'all');
  if (thresholdMs > 0) params.set('thresholdMs', String(thresholdMs));

  const data = await fetchJSON(
    `/api/sessions/${
      state.currentSessionId
    }/slow-functions?${params.toString()}`,
  );
  state.slowFunctions.total = Number(data.total || 0);
  state.slowFunctions.page = Number(data.page || 1);
  state.slowFunctions.pageSize = Number(
    data.pageSize || state.slowFunctions.pageSize,
  );
  state.slowFunctions.totalPages = Number(data.totalPages || 1);
  state.slowFunctions.items = data.items || [];
  renderSlowFunctions();
}

async function refreshRepeatedCalls() {
  if (!state.currentSessionId) return;
  const moduleFilter = document.getElementById('moduleFilter')?.value || 'all';
  const mode =
    document.getElementById('repeatMode')?.value ||
    state.repeatedCalls.mode ||
    'rapid';
  state.repeatedCalls.mode = mode;

  const params = new URLSearchParams();
  params.set('page', String(state.repeatedCalls.page));
  params.set('pageSize', String(state.repeatedCalls.pageSize));
  params.set('module', moduleFilter || 'all');
  params.set('minCount', '3');
  params.set('mode', mode);

  const data = await fetchJSON(
    `/api/sessions/${
      state.currentSessionId
    }/repeated-calls?${params.toString()}`,
  );
  state.repeatedCalls.total = Number(data.total || 0);
  state.repeatedCalls.page = Number(data.page || 1);
  state.repeatedCalls.pageSize = Number(
    data.pageSize || state.repeatedCalls.pageSize,
  );
  state.repeatedCalls.totalPages = Number(data.totalPages || 1);
  state.repeatedCalls.items = data.items || [];
  renderRepeatedCalls();
}

function renderSelection() {
  const box = document.getElementById('selectionDetails');
  if (!state.selection) {
    box.classList.add('hidden');
    return;
  }
  const ev = state.selection;
  const base = state.timeline.minTs || 0;

  const formatDetail = (detail) => {
    if (detail === undefined) return '';
    try {
      const text =
        typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2);
      return text.length > 1200 ? `${text.slice(0, 1200)}…` : text;
    } catch {
      return String(detail);
    }
  };

  if (ev.type === 'mark') {
    document.getElementById('selTitle').textContent = `${ev.name || 'mark'}`;
    document.getElementById('selTiming').textContent = `@ ${formatMs(
      ev.start - base,
    )}`;
    document.getElementById('selFile').textContent = 'Mark';
    document.getElementById('selStack').textContent = formatDetail(ev.detail);
  } else if (ev.type === 'module') {
    document.getElementById('selTitle').textContent = `${
      ev.module || 'module load'
    }`;
    document.getElementById('selTiming').textContent = `${formatMs(
      ev.duration,
    )} @ ${formatMs(ev.start - base)}`;
    document.getElementById('selFile').textContent = ev.path || '';
    document.getElementById('selStack').textContent = 'Module load';
  } else {
    const stack = Array.isArray(ev.stack) ? ev.stack : [];
    document.getElementById('selTitle').textContent = `${ev.name} (${
      ev.module || 'unknown'
    })`;
    document.getElementById('selTiming').textContent = `${formatMs(
      ev.duration,
    )} @ ${formatMs(ev.start - base)}`;
    document.getElementById('selFile').textContent = `${ev.file || ''}:${
      ev.line || 0
    }`;
    document.getElementById('selStack').textContent = stack.length
      ? `${stack.join(' → ')} → ${ev.name}`
      : ev.name;
  }
  box.classList.remove('hidden');
}

async function loadKeyMarks(sessionId = state.currentSessionId) {
  if (!sessionId) return;
  const container = document.getElementById('keyMarksContent');
  container.innerHTML = '<div class="text-slate-400">Loading...</div>';
  try {
    const data = await fetchJSON(`/api/sessions/${sessionId}/key-marks`);
    if (state.currentSessionId !== sessionId) return;
    if (!data.marks || !Object.keys(data.marks).length) {
      container.innerHTML =
        '<div class="text-slate-500">No key marks found</div>';
      return;
    }
    const rows = Object.entries(data.marks)
      .map(([name, info]) => {
        const sinceStart = info.first?.sinceSessionStartMs;
        const timing =
          sinceStart !== null && sinceStart !== undefined
            ? formatMs(sinceStart)
            : '-';
        return `<tr>
          <td class="py-1 pr-4 font-mono text-xs">${name}</td>
          <td class="py-1 pr-4 text-right">${timing}</td>
          <td class="py-1 pr-4 text-right text-slate-400">${info.count}x</td>
        </tr>`;
      })
      .join('');
    container.innerHTML = `
      <div class="text-xs text-slate-400 mb-2">Session start: ${
        data.sessionStart ? new Date(data.sessionStart).toLocaleString() : '-'
      }</div>
      <table class="min-w-full">
        <thead class="text-slate-400 border-b border-dark-border text-xs">
          <tr><th class="py-1 pr-4 text-left">Mark</th><th class="py-1 pr-4 text-right">Since Start</th><th class="py-1 pr-4 text-right">Count</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;
  } catch (err) {
    if (state.currentSessionId !== sessionId) return;
    container.innerHTML = `<div class="text-red-400">Error: ${err.message}</div>`;
  }
}

async function loadHomeRefresh(sessionId = state.currentSessionId) {
  if (!sessionId) return;
  const container = document.getElementById('homeRefreshContent');
  container.innerHTML = '<div class="text-slate-400">Loading...</div>';
  try {
    const data = await fetchJSON(`/api/sessions/${sessionId}/home-refresh`);
    if (state.currentSessionId !== sessionId) return;
    if (data.error) {
      container.innerHTML = `<div class="text-slate-500">${data.error}</div>`;
      return;
    }
    const topFns = (data.topFunctions || []).slice(0, 15);
    const fnRows = topFns
      .map(
        (f) => `<tr>
        <td class="py-1 pr-4">${f.name}</td>
        <td class="py-1 pr-4 text-slate-400 text-xs">${f.module || ''}</td>
        <td class="py-1 pr-4 text-right">${formatMs(f.total)}</td>
        <td class="py-1 pr-4 text-right text-slate-400">${f.count}x</td>
      </tr>`,
      )
      .join('');
    const bgcallRows = (data.bgcallMarksTop || [])
      .slice(0, 5)
      .map(
        (m) =>
          `<div class="text-xs"><span class="text-slate-400">${formatMs(
            m.duration,
          )}</span> ${m.name}</div>`,
      )
      .join('');
    const jsblockRows = (data.jsblockMarksTop || [])
      .slice(0, 5)
      .map(
        (m) =>
          `<div class="text-xs"><span class="text-red-400">${formatMs(
            m.duration,
          )}</span> ${m.name}</div>`,
      )
      .join('');
    container.innerHTML = `
      <div class="grid gap-4 md:grid-cols-2 mb-4">
        <div>
          <div class="text-xs text-slate-400">Refresh Window</div>
          <div class="font-semibold">${formatMs(data.span || 0)}</div>
          <div class="text-xs text-slate-400">Start: ${
            data.startSinceSessionStartMs !== null &&
            data.startSinceSessionStartMs !== undefined
              ? formatMs(data.startSinceSessionStartMs)
              : '-'
          } → End: ${
            data.endSinceSessionStartMs !== null &&
            data.endSinceSessionStartMs !== undefined
              ? formatMs(data.endSinceSessionStartMs)
              : '-'
          }</div>
        </div>
        <div>
          <div class="text-xs text-slate-400">Function Calls</div>
          <div class="font-semibold">${
            data.totals?.functionCalls || 0
          } calls, ${formatMs(
            data.totals?.functionTotalDuration || 0,
          )} total</div>
        </div>
      </div>
      ${
        bgcallRows
          ? `<div class="mb-3"><div class="text-xs text-slate-400 mb-1">BG Calls</div>${bgcallRows}</div>`
          : ''
      }
      ${
        jsblockRows
          ? `<div class="mb-3"><div class="text-xs text-slate-400 mb-1">JS Blocks</div>${jsblockRows}</div>`
          : ''
      }
      <div class="text-xs text-slate-400 mb-1">Top Functions</div>
      <table class="min-w-full text-sm">
        <thead class="text-slate-400 border-b border-dark-border text-xs">
          <tr><th class="py-1 pr-4 text-left">Function</th><th class="py-1 pr-4 text-left">Module</th><th class="py-1 pr-4 text-right">Total</th><th class="py-1 pr-4 text-right">Count</th></tr>
        </thead>
        <tbody>${fnRows}</tbody>
      </table>`;
  } catch (err) {
    if (state.currentSessionId !== sessionId) return;
    container.innerHTML = `<div class="text-red-400">Error: ${err.message}</div>`;
  }
}

async function loadJsBlock(sessionId = state.currentSessionId) {
  if (!sessionId) return;
  const container = document.getElementById('jsBlockContent');
  container.innerHTML = '<div class="text-slate-400">Loading...</div>';
  try {
    const data = await fetchJSON(`/api/sessions/${sessionId}/jsblock`);
    if (state.currentSessionId !== sessionId) return;
    if (!data.topWindows?.length) {
      container.innerHTML =
        '<div class="text-slate-500">No JS block events found (threshold: 200ms)</div>';
      return;
    }
    const windowsHtml = data.topWindows
      .map((w, i) => {
        const topFns = (w.topFunctions || [])
          .slice(0, 20)
          .map(
            (f) =>
              `<div class="text-xs pl-4"><span class="text-slate-400">${formatMs(
                f.total,
              )}</span> ${f.name} <span class="text-slate-500">(${
                f.count
              }x)</span></div>`,
          )
          .join('');
        return `
        <div class="border border-dark-border rounded p-3 mb-2">
          <div class="flex justify-between items-center mb-2">
            <div class="font-semibold text-red-400">#${i + 1} Block: ${formatMs(
              w.span,
            )}</div>
            <div class="text-xs text-slate-400">${
              w.totals?.functionCalls || 0
            } function calls</div>
          </div>
          ${
            topFns
              ? `<div class="text-xs text-slate-400 mb-1">Top Functions:</div>${topFns}`
              : ''
          }
        </div>`;
      })
      .join('');
    container.innerHTML = `
      <div class="text-xs text-slate-400 mb-2">Found ${data.topWindows.length} JS block windows (min drift: ${data.minDriftMs}ms)</div>
      ${windowsHtml}`;
  } catch (err) {
    if (state.currentSessionId !== sessionId) return;
    container.innerHTML = `<div class="text-red-400">Error: ${err.message}</div>`;
  }
}

async function loadLowFps(sessionId = state.currentSessionId) {
  if (!sessionId) return;
  const container = document.getElementById('lowFpsContent');
  const threshold =
    Number(document.getElementById('fpsThreshold')?.value) || 10;
  container.innerHTML = '<div class="text-slate-400">Loading...</div>';
  try {
    const data = await fetchJSON(
      `/api/sessions/${sessionId}/low-fps?threshold=${threshold}`,
    );
    if (state.currentSessionId !== sessionId) return;
    if (!data.topWindows?.length) {
      container.innerHTML = `<div class="text-slate-500">No low FPS windows found (threshold: ${threshold} fps)</div>`;
      return;
    }
    const windowsHtml = data.topWindows
      .map((w, i) => {
        const topFns = (w.topFunctions || [])
          .slice(0, 20)
          .map(
            (f) =>
              `<div class="text-xs pl-4"><span class="text-slate-400">${formatMs(
                f.total,
              )}</span> ${f.name} <span class="text-slate-500">(${
                f.count
              }x)</span></div>`,
          )
          .join('');
        return `
        <div class="border border-dark-border rounded p-3 mb-2">
          <div class="flex justify-between items-center mb-2">
            <div class="font-semibold text-orange-400">#${
              i + 1
            } Low FPS: ${formatMs(w.span)}</div>
            <div class="text-xs text-slate-400">FPS: ${
              w.fps?.min?.toFixed(0) || '-'
            } - ${w.fps?.max?.toFixed(0) || '-'} (avg ${
              w.fps?.avg?.toFixed(1) || '-'
            })</div>
          </div>
          ${
            topFns
              ? `<div class="text-xs text-slate-400 mb-1">Top Functions:</div>${topFns}`
              : ''
          }
        </div>`;
      })
      .join('');
    container.innerHTML = `
      <div class="text-xs text-slate-400 mb-2">Found ${data.topWindows.length} low FPS windows (threshold: ${data.thresholdFps} fps)</div>
      ${windowsHtml}`;
  } catch (err) {
    if (state.currentSessionId !== sessionId) return;
    container.innerHTML = `<div class="text-red-400">Error: ${err.message}</div>`;
  }
}

async function autoLoadInsightPanels(sessionId) {
  // Defer a tick so the main session UI renders first.
  await new Promise((resolve) => setTimeout(resolve, 0));
  if (!sessionId || state.currentSessionId !== sessionId) return;
  await Promise.allSettled([
    loadKeyMarks(sessionId),
    loadHomeRefresh(sessionId),
    loadJsBlock(sessionId),
    loadLowFps(sessionId),
  ]);
}

async function init() {
  wireEvents();
  await loadSessions();
  if (state.currentSessionId) {
    loadSession(state.currentSessionId);
  }
}

document.addEventListener('DOMContentLoaded', init);
