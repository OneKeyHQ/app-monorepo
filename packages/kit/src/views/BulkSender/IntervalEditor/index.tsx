import { useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/native';
import BigNumber from 'bignumber.js';

import {
  Box,
  Form,
  HStack,
  Modal,
  Switch,
  Text,
  useForm,
} from '@onekeyhq/components';

import {
  type BulkSenderRoutes,
  type BulkSenderRoutesParams,
  IntervalTypeEnum,
} from '../types';

import type { RouteProp } from '@react-navigation/native';

type RouteProps = RouteProp<
  BulkSenderRoutesParams,
  BulkSenderRoutes.IntervalEditor
>;

function IntervalEditor() {
  const route = useRoute<RouteProps>();

  const {
    txInterval: intervalFromOut,
    intervalType: intervalTypeFromOut,
    onIntervalChanged,
  } = route.params;

  const [isIntervalEnabled, setIsIntervalEnabled] = useState(
    intervalTypeFromOut !== IntervalTypeEnum.Off,
  );

  const useFormReturn = useForm<{
    minInterval: string;
    maxInterval: string;
  }>({
    mode: 'onChange',
    reValidateMode: 'onBlur',
  });
  const {
    control,
    formState,
    watch,
    trigger: triggerForm,
    getValues,
    setValue,
  } = useFormReturn;

  const handleConfirmInterval = useCallback(() => {
    const { minInterval, maxInterval } = getValues();

    let intervalType;

    if (isIntervalEnabled) {
      if (minInterval === maxInterval) {
        intervalType = IntervalTypeEnum.Fixed;
      } else {
        intervalType = IntervalTypeEnum.Random;
      }
    } else {
      intervalType = IntervalTypeEnum.Off;
    }

    onIntervalChanged?.({
      intervalType,
      txInterval: [minInterval, maxInterval],
    });
  }, [getValues, isIntervalEnabled, onIntervalChanged]);

  const validateInterval = useCallback(
    (value, type?: 'min' | 'max') => {
      if (type === 'min') {
        const minValueBN = new BigNumber(value);
        const maxValue = getValues('maxInterval');
        if (minValueBN.decimalPlaces() > 3) {
          setValue('minInterval', new BigNumber(value).toFixed(3));
        }

        if (minValueBN.isGreaterThan(maxValue)) {
          return 'min value must be less than max value';
        }
      } else if (type === 'max') {
        const maxValueBN = new BigNumber(value);
        const minValue = getValues('minInterval');
        if (maxValueBN.decimalPlaces() > 3) {
          setValue('maxInterval', new BigNumber(value).toFixed(3));
        }
        if (maxValueBN.isLessThan(minValue)) {
          return 'max value must be greater than min value';
        }
      }
    },
    [getValues, setValue],
  );

  const isConfirmDisabeld = useMemo(
    () => (isIntervalEnabled ? !formState.isValid : false),
    [formState.isValid, isIntervalEnabled],
  );

  const watchInterval = watch(['minInterval', 'maxInterval']);
  const intervalDesc = useMemo(
    () =>
      `Sending time for all addresses will be randomized from ${
        watchInterval[0] ?? '1'
      }s to ${watchInterval[1] ?? '5'}s.`,
    [watchInterval],
  );

  return (
    <Modal
      header="Time Interval"
      hideSecondaryAction
      primaryActionTranslationId="action__confirm"
      primaryActionProps={{ isDisabled: isConfirmDisabeld }}
      onPrimaryActionPress={({ close }) => {
        handleConfirmInterval();
        close();
      }}
    >
      <Box flex={1}>
        <HStack alignItems="center" justifyContent="space-between">
          <Text typography="Body2Strong">Random Time Interval</Text>
          <Switch
            labelType="false"
            isChecked={isIntervalEnabled}
            onToggle={() => {
              setIsIntervalEnabled(!isIntervalEnabled);
              triggerForm();
            }}
            size="mini"
          />
        </HStack>
        {isIntervalEnabled ? (
          <Form mt={5}>
            <Form.Item
              name="minInterval"
              control={control}
              defaultValue={intervalFromOut[0] || '1'}
              label="Minimum Amount"
              rules={{
                required: true,
                validate: (value) => validateInterval(value, 'min'),
              }}
            >
              <Form.NumberInput />
            </Form.Item>
            <Form.Item
              name="maxInterval"
              control={control}
              defaultValue={intervalFromOut[1] || '5'}
              label="Maximum Amount"
              rules={{
                required: true,
                validate: (value) => validateInterval(value, 'max'),
              }}
              helpText={intervalDesc}
            >
              <Form.NumberInput />
            </Form.Item>
          </Form>
        ) : null}
      </Box>
    </Modal>
  );
}

export { IntervalEditor };
