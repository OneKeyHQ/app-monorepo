/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Icon } from 'native-base';
import React from 'react';
import SvgCheckBoxIconChecked from '../Icon/react/solid/CheckBoxIconChecked';
import SvgCheckBoxIconCheckedDisable from '../Icon/react/solid/CheckBoxIconCheckedDisable';
import SvgCheckBoxIconDefault from '../Icon/react/solid/CheckBoxIconDefault';
import SvgCheckBoxIconDefaultDisable from '../Icon/react/solid/CheckBoxIconDefaultDisable';

export const getCheckBoxIcon = (
  disable: boolean,
  defaultIsChecked: boolean,
) => {
  if (disable) {
    if (defaultIsChecked) {
      return <Icon as={SvgCheckBoxIconDefaultDisable} />;
    }
    return <Icon as={SvgCheckBoxIconCheckedDisable} />;
  }

  if (defaultIsChecked) {
    return <Icon as={SvgCheckBoxIconDefault} />;
  }
  return <Icon as={SvgCheckBoxIconChecked} />;
};
