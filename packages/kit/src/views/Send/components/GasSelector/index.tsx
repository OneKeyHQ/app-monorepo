import { useCallback, type ComponentProps } from 'react';

import { Select } from '@onekeyhq/components';

import {
  useSelectedPresetGasIndexAtom,
  useSendConfirmActions,
  useSendGasTypeAtom,
} from '../../../../states/jotai/contexts/send-confirm';

import { GasSelectorTrigger } from './GasSelectorTrigger';

type IProps = {
  triggerProps?: ComponentProps<typeof GasSelectorTrigger>;
} & Partial<ComponentProps<typeof Select>>;

function GasSelector(props: IProps) {
  const { triggerProps, ...rest } = props;
  const [sendGasType] = useSendGasTypeAtom();
  const [selectedGasPresetIndex] = useSelectedPresetGasIndexAtom();

  const { updateSendGasType, updateCustomGas, updateSelectedPresetGasIndex } =
    useSendConfirmActions().current;

  const handleSelectedGasOnChange = useCallback(() => {}, []);

  return (
    <Select
      renderTrigger={() => <GasSelectorTrigger {...triggerProps} />}
      items={items}
      value={val}
      onChange={handleSelectedGasOnChange}
      title="Demo Title"
      {...rest}
    />
  );
}

export { GasSelector };
