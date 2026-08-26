export function shouldVerifyFirmwareHash({
  certificateVerified,
  useNewProcess,
}: {
  certificateVerified: boolean;
  useNewProcess?: boolean;
}) {
  return certificateVerified && Boolean(useNewProcess);
}

export function shouldRetryFirmwareVerification({
  verificationTemporarilyUnavailable,
}: {
  verificationTemporarilyUnavailable: boolean;
}) {
  return verificationTemporarilyUnavailable;
}
