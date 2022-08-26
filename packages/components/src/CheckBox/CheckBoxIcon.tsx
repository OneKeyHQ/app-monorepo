/* eslint-disable @typescript-eslint/no-unsafe-return */
import React from 'react';

import { Icon } from 'native-base';

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
      return (
        <Icon as={SvgCheckBoxIconDefaultDisable} color="interactive-disabled" />
      );
    }
    return (
      <Icon as={SvgCheckBoxIconCheckedDisable} color="interactive-disabled" />
    );
  }

  if (defaultIsChecked) {
    return <Icon as={SvgCheckBoxIconDefault} color="interactive-default" />;
  }
  return <Icon as={SvgCheckBoxIconChecked} color="interactive-default" />;
};
