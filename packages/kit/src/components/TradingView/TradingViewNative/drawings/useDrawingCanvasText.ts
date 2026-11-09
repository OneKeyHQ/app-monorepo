import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';

import { DRAWING_BARS_TEMPLATE_COUNT } from './drawingText';

import type { IDrawingCanvasText } from './drawingText';

export function useDrawingCanvasText(): IDrawingCanvasText {
  const intl = useIntl();
  return useMemo(() => {
    // Keep placeholders as `{name}` so worklets can fill them without intl.
    const template = (id: ETranslations, names: string[]) =>
      intl.formatMessage(
        { id },
        Object.fromEntries(names.map((name) => [name, `{${name}}`])),
      );
    return {
      defaultText: intl.formatMessage({
        id: ETranslations.market_drawing_tool_text__title,
      }),
      volume: template(ETranslations.market_drawing_measurement_volume__desc, [
        'volume',
      ]),
      bars: Array.from({ length: DRAWING_BARS_TEMPLATE_COUNT }, (_, count) =>
        intl
          .formatMessage(
            {
              id: ETranslations.market_drawing_measurement_bars_duration__desc,
            },
            { count, duration: '{duration}' },
          )
          .replace(intl.formatNumber(count), '{count}'),
      ),
      target: template(ETranslations.market_drawing_position_target__desc, [
        'price',
        'amount',
        'percent',
      ]),
      stop: template(ETranslations.market_drawing_position_stop__desc, [
        'price',
        'amount',
        'percent',
      ]),
      openPnl: template(ETranslations.market_drawing_position_open_pnl__desc, [
        'pnl',
        'quantity',
        'ratio',
      ]),
      closedPnl: template(
        ETranslations.market_drawing_position_closed_pnl__desc,
        ['pnl', 'quantity', 'ratio'],
      ),
    };
  }, [intl]);
}
