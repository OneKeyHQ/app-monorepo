const LOG_PREFIX = '[MKT-TV-APP]';

type IMarketKLinePointLike = {
  t?: unknown;
  c?: unknown;
};

function stringifyLogValue(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return JSON.stringify({
      stringifyError: error instanceof Error ? error.message : String(error),
    });
  }
}

export function shortMarketId(value?: string) {
  if (!value) {
    return '';
  }

  return value.length > 14
    ? `${value.slice(0, 6)}...${value.slice(-4)}`
    : value;
}

export function summarizeMarketKLineData(data?: unknown) {
  const dataRecord =
    data && typeof data === 'object'
      ? (data as { points?: unknown; total?: unknown })
      : undefined;
  const points = Array.isArray(dataRecord?.points)
    ? (dataRecord.points as IMarketKLinePointLike[])
    : [];
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  return {
    pointCount: points.length,
    total: dataRecord?.total,
    first: firstPoint
      ? {
          t: firstPoint.t,
          c: firstPoint.c,
        }
      : undefined,
    last: lastPoint
      ? {
          t: lastPoint.t,
          c: lastPoint.c,
        }
      : undefined,
  };
}

export function debugMarketTradingViewLog(label: string, value?: unknown) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }

  const valueText = value === undefined ? '' : ` ${stringifyLogValue(value)}`;
  // eslint-disable-next-line no-console
  console.log(`${LOG_PREFIX} ${label}${valueText}`);
}
