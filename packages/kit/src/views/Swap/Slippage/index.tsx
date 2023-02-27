import { useCallback, useMemo, useState } from 'react';
import type { FC } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Icon,
  Modal,
  NumberInput,
  Typography,
} from '@onekeyhq/components';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useNavigation } from '../../../hooks';
import { useAppSelector } from '../../../hooks/redux';
import { ModalRoutes, RootRoutes } from '../../../routes/routesEnum';
import { setSlippage as setSlippageAction } from '../../../store/reducers/swapTransactions';
import { useSlippageLevels, useSwapSlippageAuto } from '../hooks/useSwapUtils';
import { SwapRoutes } from '../typings';

import type { ISlippageSetting } from '../typings';

type ErrorMessageProps = {
  type: 'error' | 'warn';
  message: string;
};

const ErrorMessage: FC<ErrorMessageProps> = ({ message, type }) => (
  <Box display="flex" flexDirection="row" mt="2">
    <Box mr="2">
      <Icon
        size={20}
        name="ExclamationTriangleMini"
        color={type === 'error' ? 'icon-critical' : 'icon-warning'}
      />
    </Box>
    <Typography.Body2
      color={type === 'error' ? 'text-critical' : 'text-warning'}
    >
      {message}
    </Typography.Body2>
  </Box>
);

const TypographyStrong = (text: string) => (
  <Typography.Body1>{text}</Typography.Body1>
);

const SwapAutoModeSlippageTip = () => {
  const intl = useIntl();
  const slippage = useSwapSlippageAuto();
  if (slippage && slippage.value) {
    if (slippage?.type === 'stable') {
      return (
        <Typography.Body1 color="text-subdued" my="4">
          {intl.formatMessage(
            {
              id: 'content__default_slippage_of_str_set_for_current_token_type_mainstream_asset_pairs',
            },
            {
              '1': `${slippage.value}%`,
              '2': intl.formatMessage({ id: 'content__stablecoin_pairs' }),
              'a': TypographyStrong,
            },
          )}
        </Typography.Body1>
      );
    }
    if (slippage?.type === 'popular') {
      return (
        <Typography.Body1 color="text-subdued" my="4">
          {intl.formatMessage(
            {
              id: 'content__default_slippage_of_str_set_for_current_token_type_mainstream_asset_pairs',
            },
            {
              '1': `${slippage.value}%`,
              '2': intl.formatMessage({
                id: 'content__mainstream_asset_pairs',
              }),
              'a': TypographyStrong,
            },
          )}
        </Typography.Body1>
      );
    }
    if (slippage?.type === 'others') {
      return (
        <Typography.Body1 color="text-subdued" my="4">
          {intl.formatMessage(
            {
              id: 'content__default_slippage_of_str_set_for_current_token_type_mainstream_asset_pairs',
            },
            {
              '1': `${slippage.value}%`,
              '2': intl.formatMessage({ id: 'content__altcoin_pairs' }),
              'a': TypographyStrong,
            },
          )}
        </Typography.Body1>
      );
    }
  }
  return null;
};

const Slippage = () => {
  const intl = useIntl();
  const navigation = useNavigation();
  const levels = useSlippageLevels();
  const slippage = useAppSelector((s) => s.swapTransactions.slippage);

  const [slippageCurrent, setCurrentSlippage] = useState<ISlippageSetting>(() =>
    !slippage ? { mode: 'auto' } : slippage,
  );

  const onCustomChange = useCallback((text: string) => {
    setCurrentSlippage({ mode: 'custom', value: text.trim() });
  }, []);

  const onSetAuto = useCallback(() => setCurrentSlippage({ mode: 'auto' }), []);

  const onPresetChange = useCallback(
    (value?: string) => setCurrentSlippage({ mode: 'preset', value }),
    [],
  );

  const getButtonType = useCallback(
    (value?: string) =>
      slippageCurrent.mode === 'preset' && slippageCurrent.value === value
        ? 'primary'
        : 'basic',
    [slippageCurrent],
  );

  const errorMsg = useMemo<ErrorMessageProps | undefined>(() => {
    if (slippageCurrent && slippageCurrent.mode === 'custom') {
      const slippageValue = slippageCurrent.value
        ? slippageCurrent.value.trim()
        : '';
      if (!slippageValue) {
        return {
          type: 'error',
          message: intl.formatMessage({
            id: 'msg__enter_a_valid_slippage_percentage',
          }),
        };
      }
      const value = new BigNumber(slippageValue);
      if (value.gte(50) || value.eq(0)) {
        return {
          type: 'error',
          message: intl.formatMessage({
            id: 'msg__enter_a_value_50_to_save_the_slippage',
          }),
        };
      }
      if (value.lt(0.1)) {
        return {
          type: 'warn',
          message: intl.formatMessage({
            id: 'msg__your_transaction_may_fail',
          }),
        };
      }
      if (value.gte(5) && value.lt(50)) {
        return {
          type: 'warn',
          message: intl.formatMessage({
            id: 'msg__your_transaction_may_be_frontrun',
          }),
        };
      }
    }
  }, [slippageCurrent, intl]);

  const onSubmit = useCallback(() => {
    if (slippage?.mode === 'auto' && slippageCurrent.mode !== 'auto') {
      navigation.navigate(RootRoutes.Modal, {
        screen: ModalRoutes.Swap,
        params: {
          screen: SwapRoutes.SlippageCheck,
          params: slippageCurrent,
        },
      });
    } else {
      backgroundApiProxy.dispatch(setSlippageAction(slippageCurrent));
      navigation.goBack();
    }
  }, [slippage, slippageCurrent, navigation]);

  return (
    <Modal
      header={intl.formatMessage({ id: 'form__slippage_tolerance' })}
      footer={null}
    >
      <Box flexDirection="row" justifyContent="space-between">
        <Box w="22%">
          <Button
            w="full"
            type={slippageCurrent.mode === 'auto' ? 'primary' : 'basic'}
            onPress={onSetAuto}
          >
            {intl.formatMessage({ id: 'form__auto' })}
          </Button>
        </Box>
        <Box w="22%">
          <Button
            w="full"
            type={getButtonType(levels.stable)}
            onPress={() => onPresetChange(levels.stable)}
          >{`${levels.stable}%`}</Button>
        </Box>
        <Box w="22%">
          <Button
            w="full"
            type={getButtonType(levels.popular)}
            onPress={() => onPresetChange(levels.popular)}
          >{`${levels.popular}%`}</Button>
        </Box>
        <Box w="22%">
          <Button
            w="full"
            type={getButtonType(levels.others)}
            onPress={() => onPresetChange(levels.others)}
          >{`${levels.others}%`}</Button>
        </Box>
      </Box>
      <Box mt="3">
        <NumberInput
          w="full"
          size="xl"
          mt="1"
          mb="2"
          rightText="%"
          value={slippageCurrent.mode === 'custom' ? slippageCurrent.value : ''}
          placeholder={intl.formatMessage({ id: 'content__custom' })}
          onChangeText={onCustomChange}
        />
        {errorMsg ? <ErrorMessage {...errorMsg} /> : null}
      </Box>
      {slippageCurrent.mode === 'auto' ? <SwapAutoModeSlippageTip /> : null}
      {slippageCurrent.mode === 'preset' &&
      slippageCurrent.value === levels.stable ? (
        <Typography.Body1 color="text-subdued" my="4">
          {intl.formatMessage(
            {
              id: 'content__str_is_recommended_as_the_default_slippage_for_stablecoin_pairs',
            },
            {
              '0': `${levels.stable}%`,
              'a': TypographyStrong,
            },
          )}
        </Typography.Body1>
      ) : null}
      {slippageCurrent.mode === 'preset' &&
      slippageCurrent.value === levels.popular ? (
        <Typography.Body1 color="text-subdued" my="4">
          {intl.formatMessage(
            {
              id: 'content__str_is_recommended_as_the_default_slippage_for_mainstream_asset_pairs',
            },
            {
              '0': `${levels.popular}%`,
              'a': TypographyStrong,
            },
          )}
        </Typography.Body1>
      ) : null}
      {slippageCurrent.mode === 'preset' &&
      slippageCurrent.value === levels.others ? (
        <Typography.Body1 color="text-subdued" my="4">
          {intl.formatMessage(
            {
              id: 'content__str_is_recommended_as_the_default_slippage_for_altcoin_pairs',
            },
            {
              '0': `${levels.others}%`,
              'a': TypographyStrong,
            },
          )}
        </Typography.Body1>
      ) : null}
      <Box>
        <Typography.Body1Strong my="4">
          {intl.formatMessage({ id: 'content__what_is_slippage' })}
        </Typography.Body1Strong>
        <Typography.Body1 color="text-subdued">
          {intl.formatMessage({ id: 'content__what_is_slippage_desc' })}
        </Typography.Body1>
      </Box>
      <Box mt="4">
        <Button
          isDisabled={!!(errorMsg?.type === 'error')}
          onPress={onSubmit}
          w="full"
          size="lg"
          type="primary"
        >
          {intl.formatMessage({ id: 'action__save' })}
        </Button>
      </Box>
    </Modal>
  );
};

export default Slippage;
