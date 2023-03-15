import type { FC } from 'react';
import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Box, Switch, VStack } from '@onekeyhq/components';

import { showOverlay } from '../../../utils/overlayUtils';
import { BottomSheetSettings } from '../../Overlay/BottomSheetSettings';
import { AssetType } from '../types';

import type { Filter } from '../types';

type Props = {
  onChange: (filter: Filter) => void;
  isFromRpc: boolean;
} & Filter;

const ExtraFilters: FC<Props> = (props) => {
  const intl = useIntl();

  const { onChange, isFromRpc, ...filters } = props;

  const handleChange = useCallback(
    (
      k:
        | 'includeZeroBalancesTokens'
        | 'includeUnverifiedTokens'
        | 'includeTokensWithoutAllowances',
    ) => {
      onChange({
        ...filters,
        [k]: !filters[k],
      });
    },
    [onChange, filters],
  );

  return (
    <VStack pb="60px">
      {filters.assetType === AssetType.tokens ? (
        <>
          <Switch
            isChecked={filters.includeUnverifiedTokens}
            label={intl.formatMessage({
              id: 'form__include_unverified_tokens',
            })}
            isFullMode
            onToggle={() => handleChange('includeUnverifiedTokens')}
          />
          <Box h="6" />
        </>
      ) : null}
      <Switch
        isChecked={filters.includeZeroBalancesTokens}
        label={intl.formatMessage({ id: 'form__include_zero_balances' })}
        isFullMode
        onToggle={() => handleChange('includeZeroBalancesTokens')}
      />
      <>
        <Box h="6" />
        <Switch
          isChecked={filters.includeTokensWithoutAllowances}
          label={intl.formatMessage({
            id: 'form__include_tokens_without_allowances',
          })}
          isFullMode
          onToggle={() => handleChange('includeTokensWithoutAllowances')}
        />
      </>
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
    assetType: props.assetType,
    includeUnverifiedTokens: props.includeUnverifiedTokens,
    includeZeroBalancesTokens: props.includeZeroBalancesTokens,
    includeTokensWithoutAllowances: props.includeTokensWithoutAllowances,
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
