import type { ISeriesPrimitive, Time } from 'lightweight-charts';

type IPulseCrosshair = {
  x: number;
  pointX: number;
  pointY: number;
  color?: string;
  style?: number;
};

// Keep the Catalyst WebView implementation in htmlTemplate.ts in sync.
export function createPulseCrosshairPrimitive(
  getCrosshair: () => IPulseCrosshair | undefined,
  gapRadius: number,
): ISeriesPrimitive<Time> {
  const views: ReturnType<NonNullable<ISeriesPrimitive<Time>['paneViews']>> = [
    {
      zOrder: () => 'top',
      renderer: () => ({
        draw(target) {
          const crosshair = getCrosshair();
          if (!crosshair) return;
          target.useMediaCoordinateSpace(({ context, mediaSize }) => {
            const { x, pointX, pointY, color, style } = crosshair;
            context.save();
            if (Math.abs(x - pointX) < gapRadius) {
              const top = Math.max(
                0,
                Math.min(mediaSize.height, pointY - gapRadius),
              );
              const bottom = Math.max(
                0,
                Math.min(mediaSize.height, pointY + gapRadius),
              );
              context.beginPath();
              context.rect(0, 0, mediaSize.width, top);
              context.rect(
                0,
                bottom,
                mediaSize.width,
                mediaSize.height - bottom,
              );
              context.clip();
            }
            context.strokeStyle = color ?? 'rgba(150, 150, 150, 0.4)';
            context.lineWidth = 1;
            context.setLineDash(
              [[], [1, 1], [2, 2], [6, 6], [1, 4]][style ?? 3] ?? [],
            );
            // Clip a single stroke so the dash phase stays anchored to the pane.
            context.beginPath();
            context.moveTo(x, 0);
            context.lineTo(x, mediaSize.height);
            context.stroke();
            context.restore();
          });
        },
      }),
    },
  ];
  return { paneViews: () => views };
}
