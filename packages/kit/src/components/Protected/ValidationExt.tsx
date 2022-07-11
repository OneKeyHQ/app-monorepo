import React, { FC, useCallback, useEffect, useState } from 'react';

import { Center, Spinner } from '@onekeyhq/components';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import { ValidationFields } from './types';
import Validation from './Validation';

type ValidationExtProps = {
  field?: ValidationFields;
  onOk?: (text: string, isLocalAuthentication?: boolean) => void;
};

export class UnsafeVault {
  static instance = new UnsafeVault();

  vault?: string;

  async setPassword(value: string): Promise<void> {
    this.vault = await backgroundApiProxy.engine.unsafeEncode(value);
  }

  async getPassword(): Promise<string | undefined> {
    if (!this.vault) return undefined;
    const password = await backgroundApiProxy.engine.unsafeDecode(this.vault);
    if (password) {
      const result = await backgroundApiProxy.engine.verifyMasterPassword(
        password,
      );
      return result ? password : undefined;
    }
    return undefined;
  }

  clean() {
    this.vault = undefined;
  }
}

const ValidationExt: FC<ValidationExtProps> = ({ field, onOk }) => {
  const [loaded, setLoaded] = useState(false);
  const [password, setPassword] = useState<string | undefined>();
  useEffect(() => {
    async function main() {
      const data = await UnsafeVault.instance.getPassword();
      if (data) {
        onOk?.(data, false);
      }
      setPassword(data);
      setLoaded(true);
    }
    main();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onExtOk = useCallback(
    async (text: string, isLocalAuthentication?: boolean) => {
      await UnsafeVault.instance.setPassword(text);
      onOk?.(text, isLocalAuthentication);
    },
    [onOk],
  );

  if (loaded) {
    if (!password) {
      return <Validation field={field} onOk={onExtOk} />;
    }
    return null;
  }

  return (
    <Center w="full" h="full">
      <Spinner />
    </Center>
  );
};

export default ValidationExt;
