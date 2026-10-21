import { colord } from 'colord';

// Flatten alpha tokens once so the thumb cannot blend over the filled track twice.
export function resolveDottedSliderColor(
  activeColor: string,
  trackColor: string,
  backgroundColor: string,
) {
  const active = colord(activeColor).toRgb();
  const track = colord(trackColor).toRgb();
  const background = colord(backgroundColor).toRgb();
  const blend = (front: number, under: number, alpha: number) =>
    front * alpha + under * (1 - alpha);
  return colord({
    r: blend(active.r, blend(track.r, background.r, track.a), active.a),
    g: blend(active.g, blend(track.g, background.g, track.a), active.a),
    b: blend(active.b, blend(track.b, background.b, track.a), active.a),
  }).toHex();
}
