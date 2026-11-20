export function getServerApiErrorMessage({
  translatedMessage,
  message,
}: {
  translatedMessage?: string;
  message?: string;
}) {
  return translatedMessage || message || 'OneKeyServer Unknown Error';
}
