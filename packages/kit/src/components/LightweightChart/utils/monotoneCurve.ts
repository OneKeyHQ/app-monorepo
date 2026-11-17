type ICurvePoint = { x: number; y: number };

export type IMonotoneCurveSegment = {
  cp1x: number;
  cp1y: number;
  cp2x: number;
  cp2y: number;
  x: number;
  y: number;
};

// Upper bound on the chords a single segment is split into when the curve is
// flattened for a polyline renderer.
const MAX_SAMPLES_PER_SEGMENT = 16;

function getSlope(from: ICurvePoint, to: ICurvePoint) {
  const dx = to.x - from.x;
  return dx > 0 ? (to.y - from.y) / dx : 0;
}

/**
 * Monotone tangents, the same scheme as d3's `curveMonotoneX`. Each segment
 * stays monotone between its two points, so the curve never bulges past a real
 * high or low the way a cardinal spline does.
 */
function getMonotoneTangents(points: ICurvePoint[]) {
  const count = points.length;
  const slopes = points
    .slice(1)
    .map((point, index) => getSlope(points[index], point));
  const tangents = Array.from<number>({ length: count }).fill(0);
  if (count === 2) {
    tangents[0] = slopes[0];
    tangents[1] = slopes[0];
    return tangents;
  }
  for (let i = 1; i < count - 1; i += 1) {
    const s0 = slopes[i - 1];
    const s1 = slopes[i];
    if (s0 * s1 > 0) {
      const h0 = points[i].x - points[i - 1].x;
      const h1 = points[i + 1].x - points[i].x;
      const p = (s0 * h1 + s1 * h0) / (h0 + h1);
      tangents[i] =
        Math.sign(s0) *
        Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) *
        2;
    }
  }
  tangents[0] = (3 * slopes[0] - tangents[1]) / 2;
  tangents[count - 1] = (3 * slopes[count - 2] - tangents[count - 2]) / 2;
  return tangents;
}

/**
 * Cubic Bézier segments through every point, in order. The curve starts at
 * `points[0]`; segment `i` ends at `points[i + 1]`.
 */
export function buildMonotoneCurveSegments(
  points: ICurvePoint[],
): IMonotoneCurveSegment[] {
  if (points.length < 2) {
    return [];
  }
  const tangents = getMonotoneTangents(points);
  return points.slice(1).map((point, index) => {
    const previous = points[index];
    const third = (point.x - previous.x) / 3;
    return {
      cp1x: previous.x + third,
      cp1y: previous.y + third * tangents[index],
      cp2x: point.x - third,
      cp2y: point.y - third * tangents[index + 1],
      x: point.x,
      y: point.y,
    };
  });
}

/**
 * The same curve flattened into a polyline for renderers that only draw
 * straight runs. Every input point is kept, so a cut at a data point still
 * lands on the curve.
 */
export function sampleMonotoneCurve(
  points: ICurvePoint[],
  maxStep = 1,
): ICurvePoint[] {
  if (points.length < 3) {
    return points;
  }
  const sampled: ICurvePoint[] = [points[0]];
  buildMonotoneCurveSegments(points).forEach((segment, index) => {
    const start = points[index];
    const steps = Math.min(
      MAX_SAMPLES_PER_SEGMENT,
      Math.max(1, Math.ceil((segment.x - start.x) / maxStep)),
    );
    for (let step = 1; step < steps; step += 1) {
      const t = step / steps;
      const u = 1 - t;
      const a = u * u * u;
      const b = 3 * u * u * t;
      const c = 3 * u * t * t;
      const d = t * t * t;
      sampled.push({
        x: a * start.x + b * segment.cp1x + c * segment.cp2x + d * segment.x,
        y: a * start.y + b * segment.cp1y + c * segment.cp2y + d * segment.y,
      });
    }
    sampled.push(points[index + 1]);
  });
  return sampled;
}
