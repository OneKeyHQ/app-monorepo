import type { ReactElement, ReactNode } from 'react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';
import { useIntl } from 'react-intl';
import { TouchableOpacity } from 'react-native';

import {
  Box,
  HStack,
  Icon,
  Pressable,
  Spinner,
  Text,
  Tooltip,
} from '@onekeyhq/components';
import type { IFeeInfoPayload } from '@onekeyhq/engine/src/vaults/types';

import { FormatCurrencyNativeOfAccount } from '../../../components/Format';
import { removeTrailingZeros } from '../../../utils/helper';
import { SendModalRoutes } from '../types';
import { IS_REPLACE_ROUTE_TO_FEE_EDIT } from '../utils/sendConfirmConsts';
import { useNetworkFeeInfoEditable } from '../utils/useNetworkFeeInfoEditable';

import { FeeSpeedLabel } from './FeeSpeedLabel';
import { FeeSpeedTime } from './FeeSpeedTime';

import type {
  IFeeInfoInputProps,
  SendConfirmParams,
  SendRoutesParams,
} from '../types';
import type { RouteProp } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';

type NavigationProps = StackNavigationProp<
  SendRoutesParams,
  SendModalRoutes.SendConfirm
>;
type RouteProps = RouteProp<SendRoutesParams, SendModalRoutes.SendConfirm>;

function PressableWrapper({
  children,
  canPress,
  onPress,
}: {
  children: ReactNode;
  canPress: boolean;
  onPress: () => void;
}) {
  if (canPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
        {children}
      </TouchableOpacity>
    );
  }
  return <>{children}</>;
}

function useDisableEditFeeUniversal({
  feeInfoInputEditable,
  feeInfoInputLoading,
  sendConfirmParams,
  encodedTx,
  feeInfoPayload,
  networkId,
}: {
  feeInfoInputLoading?: boolean;
  feeInfoInputEditable?: boolean;
  sendConfirmParams: SendConfirmParams;
  encodedTx: any;
  feeInfoPayload: IFeeInfoPayload | null;
  networkId: string;
}) {
  const networkFeeInfoEditable = useNetworkFeeInfoEditable({ networkId });

  const signOnlyDisabled = useMemo(() => {
    let shouldDisabled = sendConfirmParams.signOnly;
    if (
      !isNil(sendConfirmParams.feeInfoEditable) &&
      sendConfirmParams.feeInfoEditable
    ) {
      shouldDisabled = false;
    }
    return shouldDisabled;
  }, [sendConfirmParams.feeInfoEditable, sendConfirmParams.signOnly]);

  const disabled =
    feeInfoInputLoading ||
    !feeInfoInputEditable ||
    !networkFeeInfoEditable ||
    !encodedTx ||
    !feeInfoPayload ||
    signOnlyDisabled ||
    feeInfoPayload?.info?.disableEditFee;

  return disabled;
}

function FeeInfoInput({
  networkId,
  accountId,
  encodedTx,
  feeInfoPayload,
  loading,
  renderChildren,
  editable,
  autoNavigateToEdit,
  sendConfirmParams,
}: IFeeInfoInputProps) {
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<RouteProps>();

  const disabled = useDisableEditFeeUniversal({
    sendConfirmParams,
    feeInfoPayload,
    feeInfoInputEditable: editable,
    feeInfoInputLoading: loading,
    encodedTx,
    networkId,
  });

  const navigateToEdit = useCallback(
    ({ replace = false }: { replace?: boolean } = {}) => {
      if (disabled) {
        console.error('FeeInfoInput is disabled');
        return;
      }
      if (replace) {
        navigation.replace(SendModalRoutes.SendEditFee, {
          networkId,
          accountId,
          encodedTx,
          feeInfoSelected: feeInfoPayload?.selected,
          autoConfirmAfterFeeSaved: autoNavigateToEdit,
          resendActionInfo: route.params.resendActionInfo,
          sendConfirmParams,
        });
      } else {
        navigation.navigate({
          // merge: true,
          // headerLeft: null,
          name: SendModalRoutes.SendEditFee,
          params: {
            networkId,
            accountId,
            encodedTx,
            feeInfoSelected: feeInfoPayload?.selected,
            autoConfirmAfterFeeSaved: autoNavigateToEdit,
            sendConfirmParams,
          },
        });
      }
    },
    [
      disabled,
      navigation,
      networkId,
      accountId,
      encodedTx,
      feeInfoPayload?.selected,
      autoNavigateToEdit,
      route.params.resendActionInfo,
      sendConfirmParams,
    ],
  );

  useEffect(() => {
    if (autoNavigateToEdit) {
      // replace not working
      navigateToEdit({ replace: true });
    }
  }, [autoNavigateToEdit, navigateToEdit]);

  return disabled ? (
    renderChildren({ isHovered: true })
  ) : (
    <Pressable
      onPress={() =>
        navigateToEdit({
          replace: IS_REPLACE_ROUTE_TO_FEE_EDIT,
        })
      }
    >
      {renderChildren}
    </Pressable>
  );
}

const FeeInfoInputContainer = memo((props: IFeeInfoInputProps) => (
  // noop
  <FeeInfoInput {...props} />
));
FeeInfoInputContainer.displayName = 'FeeInfoInputContainer';

function FeeInfoInputForConfirmLite({
  encodedTx,
  feeInfoPayload,
  loading,
  editable,
  sendConfirmParams,
  networkId,
  accountId,
  feeInfoError,
}: {
  encodedTx: any;
  feeInfoPayload: IFeeInfoPayload | null;
  loading: boolean;
  editable?: boolean;
  sendConfirmParams: SendConfirmParams;
  networkId: string;
  accountId: string;
  feeInfoError?: Error | null;
}) {
  const intl = useIntl();
  const isPreset = feeInfoPayload?.selected?.type === 'preset';

  const [hasTooltipOpen, setHasTooltipOpen] = useState(false);

  const totalNativeForDisplay =
    feeInfoPayload?.current?.totalNativeForDisplay ?? '';
  let totalFeeInNative = feeInfoPayload?.current?.totalNative ?? '';
  totalFeeInNative =
    new BigNumber(totalNativeForDisplay).isNaN() || !isPreset
      ? totalFeeInNative
      : totalNativeForDisplay;

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (encodedTx.totalFeeInNative) {
    // for UTXO model chains fee display
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    totalFeeInNative = encodedTx.totalFeeInNative;
  }

  const feeInfoDisabled = useDisableEditFeeUniversal({
    feeInfoInputLoading: loading,
    feeInfoInputEditable: editable,
    feeInfoPayload,
    networkId,
    encodedTx,
    sendConfirmParams,
  });
  const feeInfoEditable = !feeInfoDisabled;

  const title = useMemo(() => {
    if (!encodedTx || !feeInfoPayload) {
      return null;
    }

    const { custom } = feeInfoPayload.selected;

    const index = isPreset
      ? feeInfoPayload?.selected?.preset
      : custom?.similarToPreset;
    const waitingSeconds = isPreset
      ? feeInfoPayload?.info?.waitingSeconds?.[Number(index)]
      : custom?.waitingSeconds;
    return (
      <HStack alignItems="center">
        <HStack
          testID="FeeInfoInputForConfirmLite-ContentTitle-0"
          flex={1}
          space={2}
          alignItems="center"
        >
          <FeeSpeedLabel
            prices={feeInfoPayload?.info?.prices}
            isCustom={!isPreset}
            index={feeInfoPayload?.selected?.preset}
            space={1}
          />
          <FeeSpeedTime
            prices={feeInfoPayload?.info?.prices}
            index={index ?? 0}
            waitingSeconds={waitingSeconds}
            typography="Body1Strong"
            withColor
          />
        </HStack>
        {feeInfoEditable && (
          <Icon
            testID="FeeInfoInputForConfirmLite-ChevronRightMini-Icon"
            name="ChevronRightMini"
            color="icon-subdued"
          />
        )}
      </HStack>
    );
  }, [encodedTx, feeInfoEditable, feeInfoPayload, isPreset]);

  const subTitle = useMemo(() => {
    if (!encodedTx || !feeInfoPayload) {
      return null;
    }
    const totalNative = removeTrailingZeros(
      new BigNumber(totalFeeInNative || '0').toFixed(8),
    );

    return (
      <HStack space={1} alignItems="center">
        <Text>
          {`${totalNative} ${feeInfoPayload?.info?.nativeSymbol || ''}`}
        </Text>
        <FormatCurrencyNativeOfAccount
          networkId={networkId}
          accountId={accountId}
          value={totalNative}
          render={(ele) => <Text color="text-subdued">{ele}</Text>}
        />
        {loading && <Spinner size="sm" />}
      </HStack>
    );
  }, [
    accountId,
    encodedTx,
    feeInfoPayload,
    loading,
    networkId,
    totalFeeInNative,
  ]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const hint = useMemo(() => {
    if (!isPreset || !encodedTx || !feeInfoPayload) {
      return null;
    }
    let feeSpeedTime = '';
    if (feeInfoPayload?.selected?.type === 'preset') {
      if (feeInfoPayload?.selected?.preset === '0')
        feeSpeedTime = intl.formatMessage({
          id: 'content__maybe_in_30s',
        });
      if (feeInfoPayload?.selected?.preset === '1')
        feeSpeedTime = intl.formatMessage({
          id: 'content__likely_less_than_15s',
        });
      if (feeInfoPayload?.selected?.preset === '2')
        feeSpeedTime = intl.formatMessage({
          id: 'content__very_likely_less_than_15s',
        });
    }

    return (
      <Text color="text-subdued" flex={1}>
        {feeSpeedTime}
      </Text>
    );
  }, [encodedTx, feeInfoPayload, intl, isPreset]);

  const errorHint = useMemo(() => {
    if (!feeInfoError) {
      return null;
    }

    // @ts-expect-error
    const { className, key }: { className?: string; key?: string } =
      feeInfoError;

    let message: string | null = null;
    if (className === 'OneKeyError') {
      if (key !== 'onekey_error') {
        message = intl.formatMessage({
          // @ts-expect-error
          id: feeInfoError.key,
        });
      } else {
        message = feeInfoError.message;
      }
    } else {
      message = feeInfoError.message;
    }
    if (message && message.length > 350) {
      message = `${message.slice(0, 350)}...`;
    }

    return (
      !!message && (
        <Tooltip
          maxW="360px"
          isOpen={hasTooltipOpen}
          hasArrow
          label={message}
          bg="surface-neutral-default"
          _text={{ color: 'text-default', fontSize: '14px' }}
          px="16px"
          py="8px"
          placement="top"
          borderRadius="12px"
        >
          <Box>
            <Icon
              name="ExclamationTriangleOutline"
              size={20}
              color="icon-warning"
            />
          </Box>
        </Tooltip>
      )
    );
  }, [feeInfoError, hasTooltipOpen, intl]);

  const renderChildren = useCallback(
    // ({ isHovered })
    () => {
      let content = null;
      if (title) {
        content = (
          <Box flexDirection="column">
            {title}
            {subTitle}
            {/* {hint} */}
          </Box>
        );
      } else {
        content = (
          <PressableWrapper
            canPress={!!errorHint}
            onPress={() => setHasTooltipOpen(!hasTooltipOpen)}
          >
            <Box
              flexDirection="row"
              alignItems="center"
              justifyContent="flex-start"
            >
              <Text color="text-subdued" flex={1}>
                {/* show static text: No Available Fee */}
                {intl.formatMessage({ id: 'content__calculate_fee' })}
              </Text>
              <Box w={2} />
              {errorHint}
              {loading ? <Spinner size="sm" /> : null}
              <Box flex={1} />
            </Box>
          </PressableWrapper>
        );
      }

      return (
        // fee TODO encodedTxRef.current -> bg -> unsignedTx -> gasLimit -> feeInfo
        <Box>{content}</Box>
      );
    },
    [errorHint, hasTooltipOpen, intl, loading, subTitle, title],
  );

  useEffect(() => () => setHasTooltipOpen(false), []);

  return (
    <FeeInfoInputContainer
      networkId={networkId}
      accountId={accountId}
      sendConfirmParams={sendConfirmParams}
      editable={editable}
      encodedTx={encodedTx}
      feeInfoPayload={feeInfoPayload}
      loading={loading}
      renderChildren={renderChildren}
    />
  );
}

function FeeInfoInputForSpeedUpOrCancel({
  encodedTx,
  feeInfoPayload,
  loading,
  editable,
  sendConfirmParams,
  networkId,
  accountId,
}: {
  encodedTx: any;
  feeInfoPayload: IFeeInfoPayload | null;
  loading?: boolean;
  editable?: boolean;
  sendConfirmParams: SendConfirmParams;
  networkId: string;
  accountId: string;
}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const renderChildren = useCallback(({ isHovered }) => null, []);
  return (
    <FeeInfoInputContainer
      networkId={networkId}
      accountId={accountId}
      sendConfirmParams={sendConfirmParams}
      editable={editable}
      encodedTx={encodedTx}
      feeInfoPayload={feeInfoPayload}
      loading={loading}
      renderChildren={renderChildren}
      autoNavigateToEdit
    />
  );
}

export {
  FeeInfoInput,
  FeeInfoInputContainer,
  FeeInfoInputForConfirmLite,
  FeeInfoInputForSpeedUpOrCancel,
};
