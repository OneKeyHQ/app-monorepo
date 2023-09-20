import { Icon } from 'native-base';

import SvgCheckBoxIconChecked from '../Icon/react/mini/CheckBoxIconChecked';
import SvgCheckBoxIconCheckedDisable from '../Icon/react/mini/CheckBoxIconCheckedDisable';
import SvgCheckBoxIconDefault from '../Icon/react/mini/CheckBoxIconDefault';
import SvgCheckBoxIconDefaultDisable from '../Icon/react/mini/CheckBoxIconDefaultDisable';

export const getCheckBoxIcon = ({
  disable,
  defaultIsChecked,
  indeterminate,
}: {
  disable: boolean;
  defaultIsChecked: boolean;
  indeterminate: boolean;
}) => {
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

  if (indeterminate) {
    return (
      <Icon as={SvgCheckBoxIconDefaultDisable} color="interactive-default" />
    );
  }

  return <Icon as={SvgCheckBoxIconChecked} color="interactive-default" />;
};
