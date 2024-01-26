import { type ComponentProps } from 'react';

import { useIntl } from 'react-intl';

import { Select } from '@onekeyhq/components';

import { GasSelectorTrigger } from './GasSelectorTrigger';

type IProps = {
  triggerProps?: ComponentProps<typeof GasSelectorTrigger>;
} & Partial<ComponentProps<typeof Select>>;

function GasSelector(props: IProps) {
  const intl = useIntl();
  const { triggerProps, ...rest } = props;

  return (
    <Select
      renderTrigger={() => <GasSelectorTrigger {...triggerProps} />}
      title={intl.formatMessage({ id: 'content__fee' })}
      {...rest}
    />
  );
}

export { GasSelector };
