function stringifyLogValue(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return '{"stringifyError":true}';
  }
}

export function debugZcashSendLog(
  label: string,
  value: Record<string, string | number | boolean | null | undefined>,
) {
  if (process.env.NODE_ENV === 'production') {
    return;
  }
  // eslint-disable-next-line no-console
  console.log(`[ZEC-SEND] ${label} ${stringifyLogValue(value)}`);
}
