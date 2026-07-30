const MAX_SANITIZED_ERROR_MESSAGE_LENGTH = 200;

// Error messages are free text and may include credentials copied from request
// metadata. Keep the diagnostic meaning while removing common secret-bearing
// values before the message reaches UI or local logs.
export function scrubSensitiveErrorMessageText(text: string): string {
  let scrubbed = text;
  scrubbed = scrubbed.replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, '[jwt]');
  scrubbed = scrubbed.replace(/\bBearer\s+[\w.~+/-]+=*/gi, 'Bearer [token]');
  scrubbed = scrubbed.replace(/(https?:\/\/[^\s?#]+)[?#][^\s]*/gi, '$1');
  scrubbed = scrubbed.replace(
    /\b(token|access_token|refresh_token|id_token)=[^&\s#]+/gi,
    '$1=[redacted]',
  );
  scrubbed = scrubbed.replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[email]');
  if (scrubbed.length > MAX_SANITIZED_ERROR_MESSAGE_LENGTH) {
    scrubbed = `${scrubbed.slice(0, MAX_SANITIZED_ERROR_MESSAGE_LENGTH)}...`;
  }
  return scrubbed;
}
