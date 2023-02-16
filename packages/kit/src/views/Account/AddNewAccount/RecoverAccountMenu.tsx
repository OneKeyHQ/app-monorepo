import type { FC } from 'react';
import { useCallback, useMemo } from 'react';

import { CheckBox } from '@onekeyhq/components';
import BaseMenu from '@onekeyhq/kit/src/views/Overlay/BaseMenu';
import type {
  IBaseMenuOptions,
  IMenu,
} from '@onekeyhq/kit/src/views/Overlay/BaseMenu';

const RecoverAccountMenu: FC<
  IMenu & { showPath: boolean; onChange: (isChecked: boolean) => void }
> = (props) => {
  const { showPath, onChange } = props;

  const onPressShowPath = useCallback(() => {
    onChange?.(!showPath);
  }, [onChange, showPath]);

  const showPathCheckBox = useMemo(
    () => (
      <CheckBox
        w="20px"
        isChecked={showPath}
        isDisabled={false}
        onChange={onPressShowPath}
        pointerEvents="box-only"
      />
    ),
    [showPath, onPressShowPath],
  );

  const options = useMemo<IBaseMenuOptions>(
    () => [
      {
        id: 'action__show_path',
        onPress: onPressShowPath,
        extraChildren: showPathCheckBox,
      },
    ],
    [onPressShowPath, showPathCheckBox],
  );

  return <BaseMenu options={options} {...props} />;
};

export default RecoverAccountMenu;
