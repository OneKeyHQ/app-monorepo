import React, { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Box,
  Icon,
  Pressable,
  Spinner,
  Text,
  Typography,
} from '@onekeyhq/components';
import { IFeeInfoPayload } from '@onekeyhq/engine/src/types/vault';

import { FormatCurrencyNative } from '../../components/Format';
import useNavigation from '../../hooks/useNavigation';

import { FeeSpeedLabel, FeeSpeedTime } from './SendEditFee';
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
  editable,
  backRouteName,
}: {
  encodedTx: any;
  feeInfoPayload: IFeeInfoPayload | null;
  loading?: boolean;
  editable?: boolean;
  backRouteName?: keyof SendRoutesParams;
  renderChildren: ({ isHovered }: { isHovered: boolean }) => any;
}) {
  const navigation = useNavigation<NavigationProps>();

  return (
    <Pressable
      disabled={loading || !editable || !encodedTx}
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
  const intl = useIntl();
  const renderChildren = useCallback(
    ({ isHovered }) => {
      let totalDetailText = `${feeInfoPayload?.current?.total ?? '-'} ${
        feeInfoPayload?.info?.symbol ?? ''
      }`;
      const isPreset = feeInfoPayload?.selected?.type === 'preset';
      if (isPreset) {
        totalDetailText = `(${totalDetailText})`;
      }
      let icon: React.ReactElement | null = (
        <Icon size={20} name="PencilSolid" />
      );
      if (!encodedTx) {
        icon = null;
      }
      if (feeInfoPayload) {
        icon = <Icon size={20} name="PencilSolid" />;
      }
      if (loading) {
        icon = <Spinner size="sm" />;
      }
      return (
        // fee TODO encodedTxRef.current -> bg -> unsignedTx -> gasLimit -> feeInfo
        <Box
          justifyContent="space-between"
          alignItems="center"
          flexDirection="row"
          bgColor={isHovered ? 'surface-hovered' : 'surface-default'}
          borderColor="border-default"
          borderWidth="1px"
          borderRadius="12px"
          paddingX="12px"
          paddingY="8px"
        >
          <Box flex={1}>
            <Box flexDirection="row">
              {isPreset && (
                <Text
                  typography={{
                    sm: 'Body1Strong',
                    md: 'Body2Strong',
                  }}
                  mr={1}
                >
                  <FeeSpeedLabel index={feeInfoPayload?.selected?.preset} />
                </Text>
              )}
              {feeInfoPayload?.current?.totalNative && (
                <FormatCurrencyNative
                  value={feeInfoPayload?.current?.totalNative}
                  render={(ele) => (
                    <Typography.Body2 color="text-subdued">
                      (~ {ele})
                    </Typography.Body2>
                  )}
                />
              )}
            </Box>
            <Text color="text-subdued" flex={1}>
              {/* eslint-disable-next-line no-nested-ternary */}
              {feeInfoPayload?.current?.totalNative
                ? intl.formatMessage({ id: 'content__likely_less_than_15s' })
                : loading
                ? intl.formatMessage({ id: 'content__just_a_moment' })
                : intl.formatMessage({ id: 'content__calculate_fee' })}
            </Text>
          </Box>
          {icon}
        </Box>
      );
    },
    [encodedTx, feeInfoPayload, intl, loading],
  );
  return (
    <FeeInfoInput
      editable
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
  editable,
}: {
  encodedTx: any;
  feeInfoPayload: IFeeInfoPayload | null;
  loading?: boolean;
  editable?: boolean;
}) {
  const intl = useIntl();

  const renderChildren = useCallback(
    ({ isHovered }) => (
      <TxTitleDetailView
        isHovered={isHovered}
        arrow={editable && !loading && !!feeInfoPayload}
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
    [editable, feeInfoPayload, intl, loading],
  );
  return (
    <FeeInfoInput
      editable={editable}
      backRouteName={SendRoutes.SendConfirm}
      encodedTx={encodedTx}
      feeInfoPayload={feeInfoPayload}
      loading={loading}
      renderChildren={renderChildren}
    />
  );
}

export { FeeInfoInput, FeeInfoInputForTransfer, FeeInfoInputForConfirm };
