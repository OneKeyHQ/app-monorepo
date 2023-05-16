import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  NumberInput,
  Pressable,
  Select,
  Typography,
} from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';
import { useAppSelector } from '../../../../hooks';
import {
  setExpireIn,
  setInstantRate,
  setTypedPrice,
} from '../../../../store/reducers/limitOrder';
import { div, formatAmountExact } from '../../utils';

function formatExpireInString(expireIn: number) {
  const day = 60 * 24;
  const hour = 60;
  const days = Math.floor(expireIn / day);
  if (days > 0) {
    return `${days}D`;
  }
  const hours = Math.floor(expireIn / hour);
  if (hours > 0) {
    return `${hours}H`;
  }
  return `${expireIn}M`;
}

function InstantRateSetting() {
  const intl = useIntl();
  const typedPrice = useAppSelector((s) => s.limitOrder.typedPrice);

  const tokenIn = useAppSelector((s) => s.limitOrder.tokenIn);
  const tokenOut = useAppSelector((s) => s.limitOrder.tokenOut);
  const instantRate = useAppSelector((s) => s.limitOrder.instantRate);
  const mktRate = useAppSelector((s) => s.limitOrder.mktRate);

  const onChangeText = useCallback(
    (value: string) => {
      backgroundApiProxy.dispatch(
        setTypedPrice({ reversed: typedPrice.reversed, value }),
      );
      const newInstantRate = typedPrice.reversed
        ? formatAmountExact(div(1, value))
        : value;
      backgroundApiProxy.dispatch(setInstantRate(newInstantRate));
    },
    [typedPrice.reversed],
  );

  const setAsMtkPrice = useCallback(() => {
    const value = typedPrice.reversed
      ? formatAmountExact(div(1, mktRate))
      : mktRate;
    onChangeText(value);
  }, [mktRate, typedPrice.reversed, onChangeText]);

  const onSwitch = useCallback(() => {
    const newReversed = !typedPrice.reversed;
    const value = newReversed
      ? formatAmountExact(div(1, instantRate))
      : instantRate;
    backgroundApiProxy.dispatch(
      setTypedPrice({ reversed: newReversed, value }),
    );
  }, [typedPrice.reversed, instantRate]);

  const tokenA = !typedPrice.reversed ? tokenIn?.symbol : tokenOut?.symbol;
  const tokenB = !typedPrice.reversed ? tokenOut?.symbol : tokenIn?.symbol;

  return (
    <Box flex="1" backgroundColor="surface-subdued" px="4" pb="4" pt="3">
      <Box
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
      >
        <Box flexDirection="row" alignItems="center">
          <Typography.Body1 color="text-subdued" fontSize={12} fontWeight={500}>
            {intl.formatMessage(
              { id: 'form__str_price' },
              { '0': tokenA ?? '' },
            )}
          </Typography.Body1>
        </Box>

        <Pressable onPress={setAsMtkPrice}>
          <Typography.CaptionUnderline>
            {intl.formatMessage({ id: 'action__set_to_mkt' })}
          </Typography.CaptionUnderline>
        </Pressable>
      </Box>
      <Box flexDirection="row" w="full" alignItems="center">
        <Box flex="1">
          <NumberInput
            borderWidth={0}
            placeholder="0.00"
            fontSize={20}
            fontWeight="600"
            bg="transparent"
            _disabled={{ bg: 'transparent' }}
            _hover={{ bg: 'transparent' }}
            _focus={{ bg: 'transparent' }}
            borderRadius={0}
            pl={0}
            rightCustomElement={null}
            focusOutlineColor="transparent"
            value={typedPrice.value ?? ''}
            onChangeText={onChangeText}
          />
        </Box>
        <Box>
          <Pressable
            flexDirection="row"
            alignItems="center"
            bg="surface-neutral-subdued"
            py="1"
            px="1.5"
            borderRadius={8}
            onPress={onSwitch}
          >
            <Typography.CaptionStrong color="text-subdued" mr="1">
              {tokenB ?? ''}
            </Typography.CaptionStrong>
            <Icon name="ArrowsRightLeftMini" size={10} />
          </Pressable>
        </Box>
      </Box>
    </Box>
  );
}

function ExpireSetting() {
  const intl = useIntl();

  const options = useMemo(() => {
    const data = [
      {
        label: intl.formatMessage({ id: 'form__str_minute' }, { '0': 10 }),
        value: 10,
      },
      {
        label: intl.formatMessage({ id: 'form__str_hour' }, { '0': 1 }),
        value: 60,
      },
      {
        label: intl.formatMessage({ id: 'form__str_hours' }, { '0': 24 }),
        value: 1440,
      },
      {
        label: intl.formatMessage({ id: 'form__str_day' }, { '0': 7 }),
        value: 10080,
      },
      {
        label: intl.formatMessage({ id: 'form__str_day' }, { '0': 30 }),
        value: 43200,
      },
    ];
    if (platformEnv.isDev) {
      data.unshift({
        label: intl.formatMessage({ id: 'form__str_minute' }, { '0': 1 }),
        value: 1,
      });
    }
    return data;
  }, [intl]);

  const expireIn = useAppSelector((s) => s.limitOrder.expireIn);
  const onSetExpireIn = useCallback((value: number) => {
    backgroundApiProxy.dispatch(setExpireIn(value));
  }, []);

  return (
    <Box
      px="4"
      pb="4"
      pt="3"
      w="124px"
      backgroundColor="surface-subdued"
      ml="1"
      justifyContent="space-between"
    >
      <Typography.Body1 color="text-subdued" fontSize={12} fontWeight={500}>
        {intl.formatMessage({ id: 'form__expires_in' })}
      </Typography.Body1>
      <Select<number>
        title={intl.formatMessage({
          id: 'form__expires_in',
        })}
        isTriggerPlain
        footer={null}
        value={expireIn}
        defaultValue={expireIn}
        headerShown={false}
        options={options}
        dropdownProps={{ width: '64' }}
        dropdownPosition="right"
        renderTrigger={({ activeOption }) => (
          <Box
            flexDirection="row"
            alignItems="center"
            justifyContent="space-between"
          >
            <Typography.DisplayMedium>
              {formatExpireInString(activeOption.value)}
            </Typography.DisplayMedium>
            <Icon size={20} name="ChevronDownMini" />
          </Box>
        )}
        onChange={onSetExpireIn}
      />
    </Box>
  );
}

export function ParameterSetting() {
  return (
    <Box flexDirection="row" w="full" h="20" mt="1" overflow="hidden">
      <InstantRateSetting />
      <ExpireSetting />
    </Box>
  );
}
