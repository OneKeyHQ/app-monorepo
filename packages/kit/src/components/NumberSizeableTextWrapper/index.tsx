import type { INumberSizeableTextProps } from '@onekeyhq/components';
import { NumberSizeableText } from '@onekeyhq/components';
import { useSettingsValuePersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

function NumberSizeableTextWrapper(props: INumberSizeableTextProps) {
  const { hideValue, ...restProps } = props;

  const [settingsValue] = useSettingsValuePersistAtom();

  const shouldHideValue = settingsValue.hideValue && hideValue;

  return <NumberSizeableText {...restProps} hideValue={shouldHideValue} />;
}

export default NumberSizeableTextWrapper;
