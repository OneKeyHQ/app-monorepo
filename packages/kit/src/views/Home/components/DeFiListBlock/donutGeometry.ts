type IBuildDonutArcPathInput = {
  startPercent: number;
  sweepPercent: number;
  outerRadius: number;
  innerRadius: number;
  /**
   * Visual gap between slices, measured in percent of full circle. Splits
   * evenly across both ends of the slice so the "Apple-style" rounded caps
   * don't touch adjacent slices. Clamped so a slice never loses more than a
   * quarter of its sweep.
   */
  gapPercent?: number;
};

function polar(angleRad: number, radius: number) {
  const x = Math.cos(angleRad) * radius;
  const y = Math.sin(angleRad) * radius;
  return { x: Number(x.toFixed(6)), y: Number(y.toFixed(6)) };
}

function formatNumber(n: number) {
  const rounded = Math.round(n * 1e6) / 1e6;
  return Number.isInteger(rounded) ? rounded.toFixed(0) : String(rounded);
}

/**
 * Returns an SVG path for the centerline arc of a donut slice, suitable for
 * rendering with `<Path stroke strokeLinecap="round" />`. The stroke width
 * fills the ring (outer - inner). Rounded caps give the Apple-style look.
 */
export function buildDonutArcPath(input: IBuildDonutArcPathInput): string {
  const {
    startPercent,
    sweepPercent,
    outerRadius,
    innerRadius,
    gapPercent = 0,
  } = input;
  if (sweepPercent <= 0) return '';

  const centerRadius = (outerRadius + innerRadius) / 2;

  // Full ring: split into two semicircle arcs so start and end don't collapse.
  if (sweepPercent >= 100) {
    const startAngle = (startPercent / 100) * 2 * Math.PI - Math.PI / 2;
    const midAngle = startAngle + Math.PI;
    const p0 = polar(startAngle, centerRadius);
    const p1 = polar(midAngle, centerRadius);
    return [
      `M ${formatNumber(p0.x)} ${formatNumber(p0.y)}`,
      `A ${formatNumber(centerRadius)} ${formatNumber(centerRadius)} 0 1 1 ${formatNumber(p1.x)} ${formatNumber(p1.y)}`,
      `A ${formatNumber(centerRadius)} ${formatNumber(centerRadius)} 0 1 1 ${formatNumber(p0.x)} ${formatNumber(p0.y)}`,
    ].join(' ');
  }

  const effectiveGap = Math.max(0, Math.min(gapPercent, sweepPercent * 0.5));
  const effStart = startPercent + effectiveGap / 2;
  const effSweep = sweepPercent - effectiveGap;

  const startAngle = (effStart / 100) * 2 * Math.PI - Math.PI / 2;
  const endAngle = ((effStart + effSweep) / 100) * 2 * Math.PI - Math.PI / 2;
  const largeArc = effSweep > 50 ? 1 : 0;
  const start = polar(startAngle, centerRadius);
  const end = polar(endAngle, centerRadius);

  return [
    `M ${formatNumber(start.x)} ${formatNumber(start.y)}`,
    `A ${formatNumber(centerRadius)} ${formatNumber(centerRadius)} 0 ${largeArc} 1 ${formatNumber(end.x)} ${formatNumber(end.y)}`,
  ].join(' ');
}
