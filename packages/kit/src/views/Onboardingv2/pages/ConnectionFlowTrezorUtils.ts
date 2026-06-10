export function shouldRequestTrezorWebUsbPermissionBeforeListing({
  isExtension,
}: {
  isExtension: boolean;
}) {
  return isExtension;
}
