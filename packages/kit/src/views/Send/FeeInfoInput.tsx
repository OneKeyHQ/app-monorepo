import React, { useCallback, useEffect, useMemo, useRef } from 'react';

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Box, Icon, Pressable, Spinner, Text } from '@onekeyhq/components';
import { IFeeInfoPayload } from '@onekeyhq/engine/src/vaults/types';

import { FormatCurrencyNative } from '../../components/Format';
import { useActiveWalletAccount } from '../../hooks';

import { FeeSpeedLabel } from './SendEditFee';
import { TxTitleDetailView } from './TxTitleDetailView';
import { SendRoutes, SendRoutesParams } from './types';

import type { StackNavigationProp } from '@react-navigation/stack';

type NavigationProps = StackNavigationProp<
  SendRoutesParams,
  SendRoutes.SendConfirm
>;
type RouteProps = RouteProp<SendRoutesParams, SendRoutes.SendConfirm>;

export type IFeeInfoInputProps = {
  encodedTx: any;
  feeInfoPayload: IFeeInfoPayload | null;
  loading?: boolean;
  editable?: boolean;
  renderChildren: ({ isHovered }: { isHovered: boolean }) => any;
  autoNavigateToEdit?: boolean;
};
function FeeInfoInput({
  encodedTx,
  feeInfoPayload,
  loading,
  renderChildren,
  editable,
  autoNavigateToEdit,
}: IFeeInfoInputProps) {
  const navigation = useNavigation<NavigationProps>();
  const route = useRoute<RouteProps>();

  const disabled = loading || !editable || !encodedTx;
  const navigateToEdit = useCallback(
    ({ replace = false }: { replace?: boolean } = {}) => {
      if (disabled) {
        return;
      }
      if (replace) {
        navigation.replace(SendRoutes.SendEditFee, {
          encodedTx,
          feeInfoSelected: feeInfoPayload?.selected,
          autoConfirmAfterFeeSaved: autoNavigateToEdit,
          resendActionInfo: route.params.resendActionInfo,
        });
      } else {
        navigation.navigate({
          // merge: true,
          // headerLeft: null,
          name: SendRoutes.SendEditFee,
          params: {
            encodedTx,
            feeInfoSelected: feeInfoPayload?.selected,
            autoConfirmAfterFeeSaved: autoNavigateToEdit,
          },
        });
      }
    },
    [
      disabled,
      navigation,
      encodedTx,
      feeInfoPayload?.selected,
      autoNavigateToEdit,
      route.params.resendActionInfo,
    ],
  );

  useEffect(() => {
    if (autoNavigateToEdit) {
      // replace not working
      navigateToEdit({ replace: true });
    }
  }, [autoNavigateToEdit, navigateToEdit]);

  return (
    <Pressable disabled={disabled} onPress={() => navigateToEdit()}>
      {renderChildren}
    </Pressable>
  );
}

function useNetworkFeeInfoEditable() {
  const { network } = useActiveWalletAccount();
  return Boolean(network?.settings?.feeInfoEditable);
}

const FeeInfoInputContainer = React.memo((props: IFeeInfoInputProps) => {
  const networkFeeInfoEditable = useNetworkFeeInfoEditable();
  const editable = networkFeeInfoEditable && props.editable;
  return <FeeInfoInput {...props} editable={editable} />;
});
FeeInfoInputContainer.displayName = 'FeeInfoInputContainer';

function FeeInfoInputForTransfer({
  encodedTx,
  feeInfoPayload,
  loading,
  editable,
}: {
  encodedTx: any;
  feeInfoPayload: IFeeInfoPayload | null;
  loading: boolean;
  editable?: boolean;
}) {
  const intl = useIntl();
  const isPreset = feeInfoPayload?.selected?.type === 'preset';
  const showFirstTimeHint = useRef(true);
  const networkFeeInfoEditable = useNetworkFeeInfoEditable();

  const icon: React.ReactElement | null = useMemo(() => {
    if (!encodedTx) {
      return null;
    }
    if (loading) {
      return <Spinner size="sm" />;
    }
    if (feeInfoPayload && editable && networkFeeInfoEditable) {
      return <Icon size={20} name="PencilSolid" />;
    }
    return null;
  }, [editable, encodedTx, feeInfoPayload, loading, networkFeeInfoEditable]);

  const title = useMemo(() => {
    if (!encodedTx || !feeInfoPayload) {
      return null;
    }
    const totalNative = feeInfoPayload?.current?.totalNative ?? '0';

    const typography = {
      sm: 'Body1Strong',
      md: 'Body2Strong',
    } as any;

    if (isPreset) {
      return (
        <>
          <Text typography={typography}>
            <FeeSpeedLabel index={feeInfoPayload?.selected?.preset} />{' '}
            <FormatCurrencyNative
              value={totalNative}
              render={(ele) => <>(~ {ele})</>}
            />
          </Text>
        </>
      );
    }
    // TODO fallback to native value if fiat price is null
    return (
      <Text typography={typography}>
        <FormatCurrencyNative
          value={totalNative}
          render={(ele) => <>{ele}</>}
        />
      </Text>
    );
  }, [encodedTx, feeInfoPayload, isPreset]);

  const subTitle = useMemo(() => {
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

  const loadingView = useMemo(
    () => (
      <Text color="text-subdued" flex={1}>
        {intl.formatMessage({ id: 'content__calculate_fee' })}
      </Text>
    ),
    [intl],
  );
  const hint = useMemo(() => {
    let text = '';
    if (!feeInfoPayload && showFirstTimeHint.current) {
      showFirstTimeHint.current = false;
      text = intl.formatMessage({ id: 'content__calculate_fee' });
    }
    if (text) {
      return (
        <Text color="text-subdued" flex={1}>
          {text}
        </Text>
      );
    }
    if (!title && !subTitle) {
      return loadingView;
    }
    return null;
  }, [feeInfoPayload, intl, loadingView, title, subTitle]);

  const renderChildren = useCallback(
    ({ isHovered }) => (
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
          {loading ? (
            loadingView
          ) : (
            <>
              {title}
              {subTitle}
              {hint}
            </>
          )}
        </Box>
        {icon}
      </Box>
    ),
    [hint, icon, loading, loadingView, subTitle, title],
  );
  return (
    <FeeInfoInputContainer
      editable={editable}
      encodedTx={encodedTx}
      feeInfoPayload={feeInfoPayload}
      loading={loading}
      renderChildren={renderChildren}
    />
  );
}

function FeeInfoInputForConfirmLite({
  encodedTx,
  feeInfoPayload,
  loading,
  editable,
}: {
  encodedTx: any;
  feeInfoPayload: IFeeInfoPayload | null;
  loading: boolean;
  editable?: boolean;
}) {
  const intl = useIntl();
  const isPreset = feeInfoPayload?.selected?.type === 'preset';
  const networkFeeInfoEditable = useNetworkFeeInfoEditable();

  let totalFeeInNative = feeInfoPayload?.current?.totalNative || '';
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (encodedTx.totalFeeInNative) {
    // for UTXO model chains fee display
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    totalFeeInNative = encodedTx.totalFeeInNative;
  }

  // edit and loading icon
  const icon: React.ReactElement | null = useMemo(() => {
    if (!encodedTx) {
      return null;
    }
    if (loading) {
      return <Spinner size="sm" />;
    }
    if (feeInfoPayload && editable && networkFeeInfoEditable) {
      return <Icon size={20} name="PencilSolid" />;
    }
    return null;
  }, [editable, encodedTx, feeInfoPayload, loading, networkFeeInfoEditable]);

  const title = useMemo(() => {
    if (!encodedTx || !feeInfoPayload) {
      return null;
    }
    const totalNative = totalFeeInNative || '0';

    const typography = {
      sm: 'Body1Strong',
      md: 'Body2Strong',
    } as any;
    return (
      <Box flexDirection="row" alignItems="center">
        <Text typography={typography}>
          {`${totalNative} ${feeInfoPayload?.info?.nativeSymbol || ''}`}
        </Text>
        <Box w={2} />
        {icon}
      </Box>
    );
  }, [encodedTx, feeInfoPayload, icon, totalFeeInNative]);

  const subTitle = useMemo(() => {
    if (!encodedTx || !feeInfoPayload) {
      return null;
    }
    const totalNative = totalFeeInNative || '0';
    const color = 'text-subdued';
    if (isPreset) {
      return (
        <>
          <Text color={color}>
            <FeeSpeedLabel index={feeInfoPayload?.selected?.preset} />{' '}
            <FormatCurrencyNative
              value={totalNative}
              render={(ele) => <>(~ {ele})</>}
            />
          </Text>
        </>
      );
    }
    // TODO fallback to native value if fiat price is null
    return (
      <>
        <Text color={color}>
          <FormatCurrencyNative
            value={totalNative}
            render={(ele) => <>{ele}</>}
          />
        </Text>
      </>
    );
  }, [encodedTx, feeInfoPayload, isPreset, totalFeeInNative]);

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

  const renderChildren = useCallback(
    // ({ isHovered })
    () => {
      let content = null;
      if (title) {
        content = (
          <Box flexDirection="column">
            {title}
            {subTitle}
            {hint}
          </Box>
        );
      } else {
        content = (
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
            {loading ? <Spinner size="sm" /> : null}
            <Box flex={1} />
          </Box>
        );
      }

      return (
        // fee TODO encodedTxRef.current -> bg -> unsignedTx -> gasLimit -> feeInfo
        <Box>{content}</Box>
      );
    },
    [hint, intl, loading, subTitle, title],
  );
  return (
    <FeeInfoInputContainer
      editable={editable}
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
  const networkFeeInfoEditable = useNetworkFeeInfoEditable();

  const renderChildren = useCallback(
    ({ isHovered }) => {
      let totalFeeInNative = feeInfoPayload?.current?.totalNative || '-';
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (encodedTx.totalFeeInNative) {
        // for UTXO model chains fee display
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        totalFeeInNative = encodedTx.totalFeeInNative;
      }
      return (
        <TxTitleDetailView
          isHovered={isHovered}
          arrow={
            editable && networkFeeInfoEditable && !loading && !!feeInfoPayload
          }
          title={`${intl.formatMessage({
            id: 'content__fee',
          })}(${intl.formatMessage({ id: 'content__estimated' })})`}
          detail={
            loading ? (
              <Spinner />
            ) : (
              `${totalFeeInNative} ${feeInfoPayload?.info?.nativeSymbol || ''}`
            )
          }
        />
      );
    },
    [
      editable,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      encodedTx.totalFeeInNative, // for UTXO model chains fee display
      feeInfoPayload,
      intl,
      loading,
      networkFeeInfoEditable,
    ],
  );
  return (
    <FeeInfoInputContainer
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
}: {
  encodedTx: any;
  feeInfoPayload: IFeeInfoPayload | null;
  loading?: boolean;
  editable?: boolean;
}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const renderChildren = useCallback(({ isHovered }) => null, []);
  return (
    <FeeInfoInputContainer
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
  FeeInfoInputForTransfer,
  FeeInfoInputForConfirm,
  FeeInfoInputForConfirmLite,
  FeeInfoInputForSpeedUpOrCancel,
};
