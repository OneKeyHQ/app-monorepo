import type { FC } from 'react';
import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { IconButton, useToast } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector, useLocalAuthentication } from '../../hooks';
import {
  isContextSupportWebAuthn,
  webAuthenticate,
} from '../../utils/webauthn';
import LocalAuthenticationButton from '../LocalAuthenticationButton';

const WebAuthnButton = () => {
  const toast = useToast();
  const intl = useIntl();
  const enableWebAuthn = useAppSelector((s) => s.settings.enableWebAuthn);
  const onPress = useCallback(async () => {
    const isOk = await webAuthenticate();
    if (isOk) {
      // toast.show({ title: intl.formatMessage({ id: 'msg__success' }) });
      backgroundApiProxy.serviceApp.webPureUnlock();
    } else {
      toast.show({ title: intl.formatMessage({ id: 'msg__unknown_error' }) });
    }
  }, [intl, toast]);
  return isContextSupportWebAuthn && enableWebAuthn ? (
    <IconButton size="xl" name="FingerPrintOutline" onPromise={onPress} />
  ) : null;
};

type AppStateUnlockButtonProps = {
  onOk?: (password: string) => void;
  onNg?: () => void;
};

const AppStateUnlockButton: FC<AppStateUnlockButtonProps> = ({
  onOk,
  onNg,
}) => {
  const enableLocalAuthentication = useAppSelector(
    (s) => s.settings.enableLocalAuthentication,
  );
  const { isOk } = useLocalAuthentication();
  if (!isOk || !enableLocalAuthentication) {
    return <WebAuthnButton />;
  }
  return <LocalAuthenticationButton onOk={onOk} onNg={onNg} />;
};

export default AppStateUnlockButton;
