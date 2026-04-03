export const XRP_DESTINATION_TAG_MAX = 4_294_967_295;

const XRP_DESTINATION_TAG_REGEXP = /^\d+$/;

export function parseXrpDestinationTag(value?: string): number | undefined {
  const rawValue = value ?? '';
  if (!rawValue) {
    return undefined;
  }
  // Keep the format strict: destination tag must be digits only,
  // with no spaces or line breaks.
  if (!XRP_DESTINATION_TAG_REGEXP.test(rawValue)) {
    return undefined;
  }

  const destinationTag = Number(rawValue);
  if (
    !Number.isSafeInteger(destinationTag) ||
    destinationTag < 0 ||
    destinationTag > XRP_DESTINATION_TAG_MAX
  ) {
    return undefined;
  }

  return destinationTag;
}
