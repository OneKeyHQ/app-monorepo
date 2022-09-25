import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { Center, Spinner } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../hooks';

import { ValidationFields } from './types';
import Validation from './Validation';

type SessionProps = {
  field?: ValidationFields;
  onOk?: (text: string, isLocalAuthentication?: boolean) => void;
  hideTitle?: boolean;
};

const Session: FC<SessionProps> = ({ field, onOk, hideTitle }) => {
  const [loaded, setLoaded] = useState(false);
  const [verifiedPwd, setVerifiedPwd] = useState(false);
  const [hasvPw, setHasPw] = useState<boolean | undefined>();
  const validationSetting = useAppSelector((s) => s.settings.validationSetting);
  const isAlwaysNeedInputPassword = useMemo(() => {
    const value = field ? !!validationSetting?.[field] : false;
    if (field && field === ValidationFields.Secret) {
      // view recovery_phrase or private_key always need input password
      return true;
    }
    return value;
  }, [validationSetting, field]);
  useEffect(() => {
    async function loadCachePassword() {
      const data = await backgroundApiProxy.servicePassword.getPassword();
      if (data) {
        setVerifiedPwd(true);
        if (platformEnv.isNative) {
          setTimeout(() => onOk?.(data, false), 500);
        } else {
          onOk?.(data, false);
        }
      }
      setHasPw(!!data);
      setLoaded(true);
    }
    if (!isAlwaysNeedInputPassword) {
      loadCachePassword();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = useCallback(
    async (text: string, isLocalAuthentication?: boolean) => {
      setVerifiedPwd(true);
      await backgroundApiProxy.servicePassword.savePassword(text);
      onOk?.(text, isLocalAuthentication);
    },
    [onOk],
  );

  if (!verifiedPwd) {
    if (isAlwaysNeedInputPassword) {
      return <Validation onOk={onSubmit} hideTitle={hideTitle} />;
    }

    if (loaded && !hasvPw) {
      return <Validation onOk={onSubmit} hideTitle={hideTitle} />;
    }
  }

  return (
    <Center w="full" h="full">
      <Spinner size="lg" />
    </Center>
  );
};

export default Session;
