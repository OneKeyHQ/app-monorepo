// cspell:ignore tickmarks
import type {
  BarPrice,
  IPrimitivePaneView,
  ISeriesPrimitive,
  PriceFormatCustom,
} from 'lightweight-charts';

export function createRightAlignedPriceAxis({
  formatValue,
  formatTicks,
  font,
  color,
}: {
  formatValue: PriceFormatCustom['formatter'];
  formatTicks?: (values: number[]) => string[];
  font: string;
  color: string;
}) {
  let ticks: { value: number; label: string }[] = [];
  let priceToCoordinate: ((value: number) => number | null) | undefined;
  const views: IPrimitivePaneView[] = [
    {
      zOrder: () => 'top',
      renderer: () => ({
        draw: (target) => {
          target.useMediaCoordinateSpace(({ context, mediaSize }) => {
            context.save();
            context.font = font;
            context.fillStyle = color;
            context.textAlign = 'right';
            context.textBaseline = 'middle';
            for (const tick of ticks) {
              const y = priceToCoordinate?.(tick.value);
              if (
                y !== undefined &&
                y !== null &&
                y >= 0 &&
                y <= mediaSize.height
              ) {
                context.fillText(tick.label, mediaSize.width - 2, y);
              }
            }
            context.restore();
          });
        },
      }),
    },
  ];
  const primitive: ISeriesPrimitive = {
    attached: ({ series }) => {
      priceToCoordinate = (value) => series.priceToCoordinate(value);
    },
    detached: () => {
      priceToCoordinate = undefined;
      ticks = [];
    },
    priceAxisPaneViews: () => views,
  };
  return {
    primitive,
    // Preserve the library's tick values and measured widths; only drawing moves.
    tickmarksFormatter: (values: BarPrice[]) => {
      const labels = formatTicks?.(values) ?? values.map(formatValue);
      ticks = values.map((value, index) => ({ value, label: labels[index] }));
      return labels;
    },
  };
}
