import { Spinner, Stack } from '@onekeyhq/components';

/**
 * Web-only landing page for the OAuth popup redirect (OAUTH_CALLBACK_WEB_PATH).
 *
 * It must render a plain loading state and do nothing else: the opener window
 * polls popup.location.href, reads `?code=...&onekey_oauth_state=...` from the
 * URL and closes this popup itself (see OAuthPopup.open). Running any session
 * logic here would race with the opener's PKCE code exchange.
 */
export default function OAuthCallbackWeb() {
  return (
    <Stack flex={1} bg="$bgApp" alignItems="center" justifyContent="center">
      <Spinner size="large" />
    </Stack>
  );
}
