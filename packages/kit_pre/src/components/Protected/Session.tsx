import type { FC } from 'react';
import { useCallback, useState } from 'react';

import { Center, Spinner } from '@onekeyhq/components';
import { encodeSensitiveText } from '@onekeyhq/engine/src/secret/encryptors/aes256';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';

import Validation from './Validation';

type SessionProps = {
  onOk?: (text: string, isLocalAuthentication?: boolean) => void;
  hideTitle?: boolean;
  placeCenter?: boolean;
  title?: string;
  subTitle?: string;
};

const Session: FC<SessionProps> = ({
  onOk,
  hideTitle,
  placeCenter,
  title,
  subTitle,
}) => {
  const [verifiedPwd, setVerifiedPwd] = useState(false);

  const onSubmit = useCallback(
    async (text: string, isLocalAuthentication?: boolean) => {
      setVerifiedPwd(true);
      const key =
        await backgroundApiProxy.servicePassword.getBgSensitiveTextEncodeKey();
      await backgroundApiProxy.servicePassword.savePassword(
        encodeSensitiveText({
          text,
          key,
        }),
      );
      onOk?.(text, isLocalAuthentication);
    },
    [onOk],
  );

  if (!verifiedPwd) {
    return (
      <Validation
        onOk={onSubmit}
        hideTitle={hideTitle}
        placeCenter={placeCenter}
        title={title}
        subTitle={subTitle}
      />
    );
  }

  return (
    <Center w="full" h="full">
      <Spinner size="lg" />
    </Center>
  );
};

export default Session;
