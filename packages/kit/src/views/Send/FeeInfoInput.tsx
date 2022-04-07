import React, { useCallback } from 'react';

import { Column, Row } from 'native-base';
import { useIntl } from 'react-intl';

import {
  Icon,
  Pressable,
  Spinner,
  Text,
  Typography,
} from '@onekeyhq/components';
import { IFeeInfoPayload } from '@onekeyhq/engine/src/types/vault';

import { FormatBalance, FormatCurrencyNative } from '../../components/Format';
import useNavigation from '../../hooks/useNavigation';

import { FeeSpeedLabel } from './SendEditFee';
import { TxTitleDetailView } from './TxTitleDetailView';
import { SendRoutes, SendRoutesParams } from './types';

import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

type NavigationProps = NativeStackNavigationProp<
  SendRoutesParams,
  SendRoutes.SendConfirm
>;

function FeeInfoInput({
  encodedTx,
  feeInfoPayload,
  loading,
  renderChildren,
  disabled,
  backRouteName,
}: {
  encodedTx: any;
  feeInfoPayload: IFeeInfoPayload | null;
  loading?: boolean;
  disabled?: boolean;
  backRouteName?: string;
  renderChildren: ({ isHovered }: { isHovered: boolean }) => any;
}) {
  const navigation = useNavigation<NavigationProps>();

  return (
    <Pressable
      disabled={!feeInfoPayload || loading || disabled}
      onPress={() => {
        if (loading) {
          return;
        }
        navigation.navigate(SendRoutes.SendEditFee, {
          backRouteName: backRouteName ?? SendRoutes.SendConfirm,
          encodedTx,
          feeInfoSelected: feeInfoPayload?.selected,
        });
      }}
    >
      {renderChildren}
    </Pressable>
  );
}

function FeeInfoInputForTransfer({
  encodedTx,
  feeInfoPayload,
  loading,
}: {
  encodedTx: any;
  feeInfoPayload: IFeeInfoPayload | null;
  loading: boolean;
}) {
  const renderChildren = useCallback(
    ({ isHovered }) => {
      let totalDetailText = `${feeInfoPayload?.current?.total ?? '-'} ${
        feeInfoPayload?.info?.symbol ?? ''
      }`;
      const isPreset = feeInfoPayload?.selected?.type === 'preset';
      if (isPreset) {
        totalDetailText = `(${totalDetailText})`;
      }
      let icon = null;
      if (feeInfoPayload) {
        icon = <Icon size={20} name="PencilSolid" />;
      }
      if (loading) {
        icon = <Spinner size="sm" />;
      }
      return (
        // fee TODO encodedTxRef.current -> bg -> unsignedTx -> gasLimit -> feeInfo
        <Row
          justifyContent="space-between"
          alignItems="center"
          bgColor={isHovered ? 'surface-hovered' : 'surface-default'}
          borderColor="border-default"
          borderWidth="1px"
          borderRadius="12px"
          paddingX="12px"
          paddingY="8px"
        >
          <Column>
            <Row>
              <Text
                typography={{
                  sm: 'Body1Strong',
                  md: 'Body2Strong',
                }}
              >
                {isPreset ? (
                  <FeeSpeedLabel index={feeInfoPayload?.selected?.preset} />
                ) : null}{' '}
                {totalDetailText}
              </Text>
            </Row>
            <Row>
              <FormatBalance
                formatOptions={{
                  fixed: feeInfoPayload?.info.nativeDecimals,
                  unit: feeInfoPayload?.info.decimals,
                }}
                balance={feeInfoPayload?.current?.total ?? ''}
                suffix={feeInfoPayload?.info.nativeSymbol}
                render={(ele) => (
                  <Typography.Body2 mt={1} color="text-subdued">
                    {!feeInfoPayload?.current?.total ? '-' : ele}
                  </Typography.Body2>
                )}
              />
            </Row>
            <Row>
              <FormatCurrencyNative
                value={feeInfoPayload?.current?.totalNative}
                render={(ele) => (
                  <Typography.Body2 mt={1} color="text-subdued">
                    {!feeInfoPayload?.current?.totalNative ? '-' : ele}
                  </Typography.Body2>
                )}
              />
            </Row>

            {/* <Typography.Body2 color="text-subdued">
                          0.001694 ETH ~ 0.001977 ETH
                        </Typography.Body2> */}
            {/* <Typography.Body2 color="text-subdued">
                          3 min
                        </Typography.Body2> */}
          </Column>

          {icon}
        </Row>
      );
    },
    [feeInfoPayload, loading],
  );
  return (
    <FeeInfoInput
      backRouteName={SendRoutes.Send}
      encodedTx={encodedTx}
      feeInfoPayload={feeInfoPayload}
      loading={loading}
      renderChildren={renderChildren}
    />
  );
}

function FeeInfoInputForConfirm({
  encodedTx,
  feeInfoPayload,
  loading,
  disabled,
}: {
  encodedTx: any;
  feeInfoPayload: IFeeInfoPayload | null;
  loading?: boolean;
  disabled?: boolean;
}) {
  const intl = useIntl();

  const renderChildren = useCallback(
    ({ isHovered }) => (
      <TxTitleDetailView
        isHovered={isHovered}
        editable={!disabled && !loading && !!feeInfoPayload}
        title={`${intl.formatMessage({
          id: 'content__fee',
        })}(${intl.formatMessage({ id: 'content__estimated' })})`}
        detail={
          loading ? (
            <Spinner />
          ) : (
            `${feeInfoPayload?.current?.totalNative || '-'} ${
              feeInfoPayload?.info?.nativeSymbol || ''
            }`
          )
        }
      />
    ),
    [disabled, feeInfoPayload, intl, loading],
  );
  return (
    <FeeInfoInput
      disabled={disabled}
      encodedTx={encodedTx}
      feeInfoPayload={feeInfoPayload}
      loading={loading}
      renderChildren={renderChildren}
    />
  );
}

export { FeeInfoInput, FeeInfoInputForTransfer, FeeInfoInputForConfirm };
