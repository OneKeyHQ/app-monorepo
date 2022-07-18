import React, { FC, useCallback, useEffect, useMemo, useState } from 'react';

import { Center, Spinner } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../hooks';

import { ValidationFields } from './types';
import Validation from './Validation';

type SessionProps = {
  field?: ValidationFields;
  onOk?: (text: string, isLocalAuthentication?: boolean) => void;
};

const Session: FC<SessionProps> = ({ field, onOk }) => {
  const [loaded, setLoaded] = useState(false);
  const [hasvPw, setHasPw] = useState<boolean | undefined>();
  const validationSetting = useAppSelector((s) => s.settings.validationSetting);
  const isSkip = useMemo(
    () => (field ? !!validationSetting?.[field] : false),
    [validationSetting, field],
  );
  useEffect(() => {
    async function load() {
      const data = await backgroundApiProxy.servicePassword.getPassword();
      if (data) {
        onOk?.(data, false);
      }
      setHasPw(!!data);
      setLoaded(true);
    }
    if (!isSkip) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSubmit = useCallback(
    async (text: string, isLocalAuthentication?: boolean) => {
      await backgroundApiProxy.servicePassword.savePassword(text);
      onOk?.(text, isLocalAuthentication);
    },
    [onOk],
  );

  if (isSkip) {
    return <Validation onOk={onSubmit} />;
  }
  if (loaded) {
    if (!hasvPw) {
      return <Validation onOk={onSubmit} />;
    }
    return null;
  }

  return (
    <Center w="full" h="full">
      <Spinner />
    </Center>
  );
};

export default Session;
