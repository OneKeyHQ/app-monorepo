export const XRP_DESTINATION_TAG_MAX = 4_294_967_295;

const XRP_DESTINATION_TAG_REGEXP = /^\d+$/;

export function parseXrpDestinationTag(value?: string): number | undefined {
  const trimmed = (value ?? '').trim();
  if (!trimmed) {
    return undefined;
  }
  if (!XRP_DESTINATION_TAG_REGEXP.test(trimmed)) {
    return undefined;
  }

  const destinationTag = Number(trimmed);
  if (
    !Number.isSafeInteger(destinationTag) ||
    destinationTag < 0 ||
    destinationTag > XRP_DESTINATION_TAG_MAX
  ) {
    return undefined;
  }

  return destinationTag;
}
