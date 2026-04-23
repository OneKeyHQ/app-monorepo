type IBuildDonutArcPathInput = {
  startPercent: number;
  sweepPercent: number;
  outerRadius: number;
  innerRadius: number;
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

export function buildDonutArcPath(input: IBuildDonutArcPathInput): string {
  const { startPercent, sweepPercent, outerRadius, innerRadius } = input;
  if (sweepPercent <= 0) return '';

  const startAngle = (startPercent / 100) * 2 * Math.PI - Math.PI / 2;
  const endAngle =
    ((startPercent + sweepPercent) / 100) * 2 * Math.PI - Math.PI / 2;

  if (sweepPercent >= 100) {
    const midAngle = startAngle + Math.PI;
    const p0Outer = polar(startAngle, outerRadius);
    const p1Outer = polar(midAngle, outerRadius);
    const p0Inner = polar(startAngle, innerRadius);
    const p1Inner = polar(midAngle, innerRadius);
    return [
      `M ${formatNumber(p0Outer.x)} ${formatNumber(p0Outer.y)}`,
      `A ${formatNumber(outerRadius)} ${formatNumber(outerRadius)} 0 1 1 ${formatNumber(p1Outer.x)} ${formatNumber(p1Outer.y)}`,
      `A ${formatNumber(outerRadius)} ${formatNumber(outerRadius)} 0 1 1 ${formatNumber(p0Outer.x)} ${formatNumber(p0Outer.y)}`,
      `L ${formatNumber(p0Inner.x)} ${formatNumber(p0Inner.y)}`,
      `A ${formatNumber(innerRadius)} ${formatNumber(innerRadius)} 0 1 0 ${formatNumber(p1Inner.x)} ${formatNumber(p1Inner.y)}`,
      `A ${formatNumber(innerRadius)} ${formatNumber(innerRadius)} 0 1 0 ${formatNumber(p0Inner.x)} ${formatNumber(p0Inner.y)}`,
      'Z',
    ].join(' ');
  }

  const largeArc = sweepPercent > 50 ? 1 : 0;
  const outerStart = polar(startAngle, outerRadius);
  const outerEnd = polar(endAngle, outerRadius);
  const innerStart = polar(startAngle, innerRadius);
  const innerEnd = polar(endAngle, innerRadius);

  return [
    `M ${formatNumber(outerStart.x)} ${formatNumber(outerStart.y)}`,
    `A ${formatNumber(outerRadius)} ${formatNumber(outerRadius)} 0 ${largeArc} 1 ${formatNumber(outerEnd.x)} ${formatNumber(outerEnd.y)}`,
    `L ${formatNumber(innerEnd.x)} ${formatNumber(innerEnd.y)}`,
    `A ${formatNumber(innerRadius)} ${formatNumber(innerRadius)} 0 ${largeArc} 0 ${formatNumber(innerStart.x)} ${formatNumber(innerStart.y)}`,
    'Z',
  ].join(' ');
}
