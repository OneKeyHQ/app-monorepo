import { useEffect, useRef } from 'react';

import { useIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  createIntercomSessionMessage,
  isIntercomBridgeHandshake,
} from '@onekeyhq/shared/src/modules3rdParty/intercom/bridge';
import { getIntercomSessionToken } from '@onekeyhq/shared/src/modules3rdParty/intercom/identity';

type IIntercomSupportFrameProps = {
  url: string;
  userId: string | null;
  // The only origin allowed to receive the session.
  supportOrigin: string;
};

export function IntercomSupportFrame({
  url,
  userId,
  supportOrigin,
}: IIntercomSupportFrameProps) {
  const intl = useIntl();
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let active = true;
    const answerHandshake = async (port: MessagePort) => {
      try {
        const token = await getIntercomSessionToken(userId);
        if (active) {
          port.postMessage(createIntercomSessionMessage(token));
        }
      } catch {
        // The hosted page times out and offers a retry rather than opening
        // support without the session the user expects.
        console.warn('Failed to deliver Intercom session');
      } finally {
        port.close();
      }
    };

    // WindowProxy survives navigation; a MessagePort belongs to the document
    // that created it, so the token cannot reach a page the frame moved to.
    const handleMessage = (event: MessageEvent<unknown>) => {
      if (
        event.origin !== supportOrigin ||
        event.source !== frameRef.current?.contentWindow ||
        event.ports.length !== 1 ||
        !isIntercomBridgeHandshake(event.data)
      ) {
        return;
      }
      void answerHandshake(event.ports[0]);
    };

    window.addEventListener('message', handleMessage);
    return () => {
      active = false;
      window.removeEventListener('message', handleMessage);
    };
  }, [supportOrigin, userId]);

  return (
    <iframe
      ref={frameRef}
      data-testid="intercom-support-frame"
      title={intl.formatMessage({ id: ETranslations.settings_contact_us })}
      src={url}
      // Messenger needs links and uploads; top navigation stays blocked so the
      // page can never replace the wallet UI around it.
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-downloads"
      style={{ width: '100%', height: '100%', border: 0 }}
    />
  );
}
