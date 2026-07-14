export function shouldRenderStockPositionsSkeleton({
  isStockMetadataLoading,
  stockOnly,
  stockTokenListResolved,
}: {
  isStockMetadataLoading?: boolean;
  stockOnly: boolean;
  stockTokenListResolved: boolean;
}) {
  return (
    stockOnly && !stockTokenListResolved && isStockMetadataLoading !== false
  );
}
