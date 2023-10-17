import type { FC } from 'react';
import { useCallback, useState } from 'react';

import { Spinner, Stack } from '@onekeyhq/components';
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

const Session: FC<SessionProps> = ({ onOk, hideTitle, title, subTitle }) => {
  // const [loaded, setLoaded] = useState(false);
  const [verifiedPwd, setVerifiedPwd] = useState(false);
  // const [hasvPw, setHasPw] = useState<boolean | undefined>();

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
        title={title}
        subTitle={subTitle}
      />
    );

    // if (loaded && !hasvPw) {
    //   return (
    //     <Validation
    //       onOk={onSubmit}
    //       hideTitle={hideTitle}
    //       title={title}
    //       subTitle={subTitle}
    //     />
    //   );
    // }
  }

  return (
    <Stack flexDirection="row" justifyContent="center" alignItems="center">
      <Spinner />
    </Stack>
  );
};

export default Session;
