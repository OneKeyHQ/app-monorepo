import React, { FC } from 'react';

import { useLocalAuthentication } from '../../hooks';
import { useSettings } from '../../hooks/redux';
import { ValidationFields } from '../Protected/types';

import LocalAuthenticationButton from './LocalAuthenticationButton';

type LocalAuthenticationButtonProps = {
  field?: ValidationFields;
  onOk?: (password: string) => void;
  onNg?: () => void;
};

const Button: FC<LocalAuthenticationButtonProps> = ({ onOk, onNg, field }) => {
  const { enableLocalAuthentication, validationState = {} } = useSettings();
  const { isOk } = useLocalAuthentication();
  if (
    !isOk ||
    !enableLocalAuthentication ||
    (field && validationState[field] === false)
  ) {
    return null;
  }
  return <LocalAuthenticationButton onOk={onOk} onNg={onNg} field={field} />;
};

export default Button;
