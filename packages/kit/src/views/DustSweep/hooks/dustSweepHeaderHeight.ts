export function getDustSweepHeaderHeightForSettling({
  headerHeight,
  estimatedHeaderHeight,
  useTransparentHeader,
}: {
  headerHeight: number;
  estimatedHeaderHeight: number;
  useTransparentHeader: boolean;
}) {
  // The nested iOS stack can initially report only the navigation bar, without
  // the top inset. Treat that value as an estimate until native layout settles.
  return useTransparentHeader
    ? Math.max(headerHeight, estimatedHeaderHeight)
    : headerHeight;
}
