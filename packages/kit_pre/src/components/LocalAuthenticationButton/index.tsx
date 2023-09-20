import type { FC } from 'react';

import { useAppSelector, useLocalAuthentication } from '../../hooks';

import LocalAuthenticationButton from './LocalAuthenticationButton';

type LocalAuthenticationButtonProps = {
  onOk?: (password: string) => void;
  onNg?: () => void;
};

const Button: FC<LocalAuthenticationButtonProps> = ({ onOk, onNg }) => {
  const enableLocalAuthentication = useAppSelector(
    (s) => s.settings.enableLocalAuthentication,
  );
  const { isOk } = useLocalAuthentication();
  if (!isOk || !enableLocalAuthentication) {
    return null;
  }
  return <LocalAuthenticationButton onOk={onOk} onNg={onNg} />;
};

export default Button;
