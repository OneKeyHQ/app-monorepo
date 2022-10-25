import React, { FC, useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Box, Switch, VStack } from '@onekeyhq/components';

import { showOverlay } from '../../../utils/overlayUtils';
import { BottomSheetSettings } from '../../Overlay/AccountValueSettings';

type Filter = Pick<
  Props,
  'includeZeroBalancesTokens' | 'includeUnverifiedTokens'
>;

type Props = {
  includeUnverifiedTokens: boolean;
  includeZeroBalancesTokens: boolean;
  onChange: (filter: Filter) => void;
};

const ExtraFilters: FC<Props> = (props) => {
  const intl = useIntl();

  const { onChange, ...filters } = props;

  const handleChange = useCallback(
    (k: 'includeZeroBalancesTokens' | 'includeUnverifiedTokens') => {
      onChange({
        ...filters,
        [k]: !filters[k],
      });
    },
    [onChange, filters],
  );

  return (
    <VStack pb="60px">
      <Switch
        isChecked={filters.includeUnverifiedTokens}
        label={intl.formatMessage({
          id: 'form__include_unverified_tokens',
        })}
        isFullMode
        onToggle={() => handleChange('includeUnverifiedTokens')}
      />
      <Box h="6" />
      <Switch
        isChecked={filters.includeZeroBalancesTokens}
        label={intl.formatMessage({ id: 'form__include_zero_balances' })}
        isFullMode
        onToggle={() => handleChange('includeZeroBalancesTokens')}
      />
    </VStack>
  );
};

const Wrapper = ({
  closeOverlay,
  onChange,
  ...props
}: Props & {
  closeOverlay: () => void;
}) => {
  const [state, setState] = useState<Filter>({
    includeUnverifiedTokens: props.includeUnverifiedTokens,
    includeZeroBalancesTokens: props.includeZeroBalancesTokens,
  });

  const close = useCallback(() => {
    closeOverlay?.();
    onChange(state);
  }, [closeOverlay, onChange, state]);

  return (
    <BottomSheetSettings closeOverlay={close}>
      <ExtraFilters {...props} {...state} onChange={setState} />
    </BottomSheetSettings>
  );
};

const showExtraFilters = (props: Props) => {
  showOverlay((closeOverlay) => (
    <Wrapper closeOverlay={closeOverlay} {...props} />
  ));
};
export default showExtraFilters;
