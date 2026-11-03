import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

import { useOverlayPageScope } from '@onekeyfe/react-native-native-overlay';
import { useNavigation, useRoute } from '@react-navigation/native';
import BigNumber from 'bignumber.js';

import {
  Button,
  Dialog,
  DialogContainer,
  type IDialogInstance,
  type IInputProps,
  IconButton,
  Input,
  Keyboard,
  NavBackButton,
  NavCloseButton,
  Page,
  Select,
  SizableText,
  Toast,
  XStack,
  YStack,
  glassBarItem,
  useBackHandler,
  type useInTabDialog,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { usePerpsActiveAccountAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalPerpRoutes } from '@onekeyhq/shared/src/routes/perp';
import type { IModalPerpParamList } from '@onekeyhq/shared/src/routes/perp';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import {
  getInternalTransferAddressError,
  isInternalTransferAmountValid,
} from '@onekeyhq/shared/src/utils/perpsInternalTransferUtils';
import {
  getHyperliquidTokenImageUrl,
  getSpotTokenDisplayName,
} from '@onekeyhq/shared/src/utils/perpsUtils';
import type {
  IInternalTransferAccount,
  IInternalTransferQuote,
  IInternalTransferSource,
} from '@onekeyhq/shared/types/hyperliquid/internalTransfer';

import { getTradingButtonStyleProps } from '../../../utils/styleUtils';
import {
  PERP_DIALOG_BUTTON_SIZE,
  PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS,
} from '../../PerpDialogLayout';

import {
  InternalTransferAmountStep,
  InternalTransferRecipientStep,
} from './InternalTransferMobileForm';
import { PerpsAmountKeypad } from './PerpsAmountKeypad';

import type { RouteProp } from '@react-navigation/native';
import type { LayoutChangeEvent } from 'react-native';

const sourceLabels: Record<IInternalTransferSource, string> = {
  trading: 'Trading Account',
  perps: 'Perps Account',
  spot: 'Spot Account',
};

const exchange = backgroundApiProxy.serviceHyperliquidExchange;

const transferInputProps: IInputProps = {
  size: 'medium',
  fontSize: 14,
  containerProps: {
    bg: '$bgStrong',
    borderRadius: '$2',
    borderColor: '$transparent',
    hoverStyle: { borderColor: '$borderHover' },
  },
};

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Unable to complete the request. Try again.';
}

function InternalTransferContent({
  account,
  onClose,
  inPage = false,
  dialogRef,
}: {
  account: IInternalTransferAccount;
  onClose: () => void;
  inPage?: boolean;
  dialogRef?: RefObject<IDialogInstance | null>;
}) {
  const navigation = useAppNavigation();
  const route = useRoute();
  const { hostKey, ownerKey } = useOverlayPageScope();
  const [activeAccount] = usePerpsActiveAccountAtom();
  const [destinationInput, setDestination] = useState('');
  const [recipientSearch, setRecipientSearch] = useState('');
  const [mobileStep, setMobileStep] = useState<'recipient' | 'amount'>(
    'recipient',
  );
  const [recipientInputWidth, setRecipientInputWidth] = useState(0);
  const [sourceInputWidth, setSourceInputWidth] = useState(0);
  const [tokenInputWidth, setTokenInputWidth] = useState(0);
  const [amount, setAmount] = useState('');
  const [selectedSource, setSelectedSource] =
    useState<IInternalTransferSource>();
  const [selectedTokenId, setSelectedTokenId] = useState<string>();
  const [review, setReview] = useState<IInternalTransferQuote>();
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [success, setSuccess] = useState(false);
  const successHandledRef = useRef(false);
  const [error, setError] = useState('');
  const destination = destinationInput.trim();
  const aligned =
    activeAccount.accountId === account.userAccountId &&
    activeAccount.accountAddress?.toLowerCase() ===
      account.expectedAccountAddress.toLowerCase();
  const addressError = getInternalTransferAddressError(
    destination,
    account.expectedAccountAddress,
  );
  const { result: recentRecipientsResult } = usePromiseResult(
    async () => {
      if (!aligned) return undefined;
      try {
        return {
          address: account.expectedAccountAddress,
          recipients:
            await exchange.getInternalTransferRecentRecipients(account),
        };
      } catch {
        // Recent recipients are optional; manual entry stays available offline.
        return undefined;
      }
    },
    [account, aligned],
    { revalidateOnFocus: true, undefinedResultIfReRun: true },
  );
  const recentRecipients =
    aligned &&
    recentRecipientsResult?.address === account.expectedAccountAddress
      ? recentRecipientsResult.recipients
      : [];

  const recentRecipientItems = recentRecipients.map((recipient) => ({
    value: recipient.address,
    label: recipient.address,
    showSelectionIndicator: false,
    labelComponent: (
      <XStack
        alignItems="center"
        justifyContent="space-between"
        gap="$3"
        py="$1"
      >
        <SizableText
          size="$bodyMdMedium"
          color={
            recipient.address === destination.toLowerCase()
              ? '$textSuccess'
              : '$text'
          }
          numberOfLines={1}
        >
          {accountUtils.shortenAddress({
            address: recipient.address,
            leadingLength: 6,
            trailingLength: 4,
          })}
        </SizableText>
        <SizableText
          size="$bodySm"
          color={
            recipient.address === destination.toLowerCase()
              ? '$textSuccess'
              : '$textSubdued'
          }
          textAlign="right"
          flexShrink={1}
          numberOfLines={1}
        >
          {numberFormat(recipient.amount, {
            formatter: 'balance',
          })}{' '}
          {getSpotTokenDisplayName(recipient.token)}
        </SizableText>
      </XStack>
    ),
  }));

  const {
    result: sourcesResult,
    run: refreshSources,
    isLoading: loadingSources,
  } = usePromiseResult(
    async () => {
      if (!aligned) return undefined;
      try {
        return { sources: await exchange.getInternalTransferSources(account) };
      } catch (cause) {
        return { error: errorMessage(cause) };
      }
    },
    [account, aligned],
    { watchLoading: true, revalidateOnFocus: true },
  );
  const source = selectedSource ?? sourcesResult?.sources?.[0];
  const validSource =
    source !== undefined && sourcesResult?.sources?.includes(source);

  const {
    result: tokensResult,
    run: refreshTokens,
    isLoading: loadingTokens,
  } = usePromiseResult(
    async () => {
      if (!aligned || !validSource || !source) return undefined;
      try {
        return {
          source,
          tokens: await exchange.getInternalTransferTokens({
            ...account,
            source,
            selectedTokenId,
          }),
        };
      } catch (cause) {
        return { source, error: errorMessage(cause) };
      }
    },
    [account, aligned, source, validSource, selectedTokenId],
    { watchLoading: true, revalidateOnFocus: true },
  );
  const tokens =
    tokensResult && tokensResult.source === source
      ? tokensResult.tokens
      : undefined;
  const tokenId =
    selectedTokenId ?? tokens?.find((token) => token.index === 0)?.id;
  const asset = tokens?.find((token) => token.id === tokenId);
  const displaySymbol = asset
    ? getSpotTokenDisplayName(asset.symbol)
    : undefined;
  const tokenError =
    tokensResult && tokensResult.source === source
      ? tokensResult.error
      : undefined;

  const {
    result: status,
    run: refreshStatus,
    isLoading: checkingStatus,
  } = usePromiseResult(
    async () => {
      if (!aligned) return undefined;
      try {
        const result = await exchange.checkInternalTransfer(account);
        if (result.status === 'confirmed') setSuccess(true);
        return result;
      } catch (cause) {
        return { status: 'error' as const, message: errorMessage(cause) };
      }
    },
    [aligned, account],
    { watchLoading: true, revalidateOnFocus: true },
  );
  const {
    result: quoteResult,
    run: refreshQuote,
    isLoading: quoting,
  } = usePromiseResult(
    async () => {
      if (
        !aligned ||
        !validSource ||
        !source ||
        !asset ||
        !tokenId ||
        addressError ||
        (inPage && mobileStep === 'recipient') ||
        review ||
        submitting
      )
        return undefined;
      try {
        return {
          destination,
          source,
          tokenId,
          quote: await exchange.getInternalTransferQuote({
            ...account,
            destination,
            source,
            tokenId,
          }),
        };
      } catch (cause) {
        return { destination, source, tokenId, error: errorMessage(cause) };
      }
    },
    [
      destination,
      source,
      asset,
      tokenId,
      validSource,
      aligned,
      addressError,
      inPage,
      mobileStep,
      account,
      review,
      submitting,
    ],
    { watchLoading: true, debounced: 400, undefinedResultIfReRun: true },
  );
  const quote =
    quoteResult?.destination === destination &&
    quoteResult.source === source &&
    quoteResult.tokenId === tokenId
      ? quoteResult.quote
      : undefined;
  const quoteError =
    quoteResult?.destination === destination &&
    quoteResult.source === source &&
    quoteResult.tokenId === tokenId
      ? quoteResult.error
      : undefined;
  const transferConfirmed = success || status?.status === 'confirmed';
  useEffect(() => {
    if (!transferConfirmed || submitting || successHandledRef.current) return;
    successHandledRef.current = true;
    onClose();
    Toast.success({ title: 'Transfer confirmed' });
  }, [transferConfirmed, submitting, onClose]);
  const pending = status?.status === 'pending' ? status.pending : undefined;
  const selectingRecipient = inPage && mobileStep === 'recipient' && !review;
  const canGoBack =
    inPage && !transferConfirmed && !pending && !selectingRecipient;
  const goBack = useCallback(() => {
    if (submitting) return;
    Keyboard.dismiss();
    if (review) setReview(undefined);
    else {
      setRecipientSearch('');
      setMobileStep('recipient');
    }
  }, [review, submitting]);
  const renderHeaderLeft = useCallback(
    () =>
      canGoBack ? (
        <NavBackButton onPress={goBack} disabled={submitting || !!review} />
      ) : (
        <NavCloseButton onPress={onClose} disabled={submitting || !!review} />
      ),
    [canGoBack, goBack, onClose, submitting, review],
  );
  const renderHeaderRight = useCallback(
    () =>
      canGoBack ? (
        <NavCloseButton onPress={onClose} disabled={submitting || !!review} />
      ) : null,
    [canGoBack, onClose, submitting, review],
  );
  const buildNativeHeaderLeftItems = useCallback(
    () => [glassBarItem(renderHeaderLeft())],
    [renderHeaderLeft],
  );
  useBackHandler(
    useCallback(() => {
      goBack();
      return true;
    }, [goBack]),
    platformEnv.isNativeAndroid && canGoBack && !review,
  );
  const ready =
    aligned &&
    validSource &&
    !loadingSources &&
    !loadingTokens &&
    !!asset &&
    (!review || (review.source === source && review.tokenId === tokenId)) &&
    status?.status === 'none' &&
    !checkingStatus &&
    !submitting;
  const validAmount =
    quote &&
    isInternalTransferAmountValid(
      amount,
      quote.maxAmount,
      quote.asset.decimals,
    );
  const amountBN = new BigNumber(amount);
  const isInsufficientBalance =
    !!quote && amountBN.isFinite() && amountBN.gt(quote.maxAmount);
  let amountError: string | undefined;
  if (
    amount &&
    quote &&
    !validAmount &&
    !isInsufficientBalance &&
    !amountBN.isZero()
  ) {
    amountError =
      amountBN.isFinite() &&
      (amountBN.decimalPlaces() ?? 0) > quote.asset.decimals
        ? `Use up to ${quote.asset.decimals} decimal places.`
        : 'Enter a valid amount.';
  }

  const submit = async () => {
    if (!review || !ready || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError('');
    try {
      const result = await exchange.transferAssetInternally({
        ...account,
        destination: review.destination,
        source: review.source,
        tokenId: review.tokenId,
        expectedToken: review.asset.token,
        amount: new BigNumber(amount).toFixed(),
        expectedFee: review.fee,
        expectedUserHasSentTx: review.userHasSentTx,
        expectedSourceDex: review.sourceDex,
        expectedDestinationDex: review.destinationDex,
      });
      setSuccess(result === 'confirmed');
      await refreshStatus();
    } catch (cause) {
      setError(errorMessage(cause));
      await refreshSources();
      await refreshTokens();
      await refreshStatus();
    } finally {
      setReview(undefined);
      setSubmitting(false);
      submittingRef.current = false;
    }
  };

  const history = () => {
    onClose();
    navigation.pushModal(EModalRoutes.PerpModal, {
      screen: EModalPerpRoutes.PerpTradersHistoryList,
      params: { initialTab: 'Account' },
    });
  };

  const available = new BigNumber(asset?.balance ?? 'NaN');
  const maxAmount =
    quote?.maxAmount ??
    (asset &&
    available.isFinite() &&
    Number.isSafeInteger(asset.decimals) &&
    asset.decimals >= 0
      ? available.decimalPlaces(asset.decimals, BigNumber.ROUND_DOWN).toFixed()
      : undefined);

  const recipientInputProps: IInputProps = {
    ...transferInputProps,
    accessibilityLabel: 'Recipient HL address',
    value: destinationInput,
    onChangeText: setDestination,
    placeholder: 'Recipient address',
    size: inPage ? 'large' : 'medium',
    fontSize: inPage ? 16 : 14,
    autoCapitalize: 'none',
    autoCorrect: false,
    disabled: !aligned || submitting || !!review,
    containerProps: {
      ...transferInputProps.containerProps,
      onLayout: (event) =>
        setRecipientInputWidth(event.nativeEvent.layout.width),
    },
  };

  const confirmButtonStyle = getTradingButtonStyleProps(
    'long',
    !ready || submitting,
  );
  const confirmAction = (
    <Button
      testID="perps-internal-transfer-confirm"
      variant="primary"
      size={PERP_DIALOG_BUTTON_SIZE}
      {...confirmButtonStyle}
      color={confirmButtonStyle.textColor}
      loading={submitting}
      disabled={!ready || submitting}
      onPress={() => void submit()}
    >
      {accountUtils.isHwAccount({ accountId: account.userAccountId })
        ? 'Confirm on device'
        : 'Confirm'}
    </Button>
  );
  const actions =
    !transferConfirmed &&
    !pending &&
    !selectingRecipient &&
    (review && !inPage ? (
      confirmAction
    ) : (
      <Button
        testID="perps-internal-transfer-review"
        size={PERP_DIALOG_BUTTON_SIZE}
        borderRadius="$full"
        mt={inPage ? '$0' : '$2'}
        variant="primary"
        loading={quoting || checkingStatus || loadingSources || loadingTokens}
        disabled={!ready || !validAmount || quoting || !!review}
        onPress={() => {
          Keyboard.dismiss();
          setError('');
          setReview(quote);
        }}
      >
        {isInsufficientBalance ? 'Insufficient balance' : 'Review'}
      </Button>
    ));

  const sourceSelector =
    inPage && sourcesResult?.sources?.length === 1 ? (
      <SizableText size="$bodyLgMedium" color="$text" textAlign="right">
        {source ? sourceLabels[source] : ''}
      </SizableText>
    ) : (
      <Select
        testID="perps-internal-transfer-source"
        title="Select account"
        placement="bottom-start"
        floatingPanelProps={
          inPage
            ? undefined
            : {
                width: sourceInputWidth || '$56',
                borderRadius: '$3',
              }
        }
        renderTrigger={({ onPress, label, disabled }) => (
          <Button
            testID="perps-internal-transfer-source-trigger"
            size={inPage ? 'medium' : 'small'}
            h={inPage ? 36 : 38}
            px={inPage ? '$0' : '$3'}
            borderRadius="$2"
            bg={inPage ? '$transparent' : '$bgStrong'}
            justifyContent="space-between"
            iconAfter="ChevronDownSmallOutline"
            accessibilityLabel="Source account"
            disabled={disabled}
            onPress={onPress}
          >
            {label || 'Select account'}
          </Button>
        )}
        value={source}
        placeholder="Select account"
        items={(sourcesResult?.sources ?? []).map((value) => ({
          value,
          label: sourceLabels[value],
          showSelectionIndicator: false,
          labelComponent: (
            <SizableText
              size={inPage ? '$bodyLgMedium' : '$bodyMdMedium'}
              color={value === source ? '$textSuccess' : '$text'}
              py="$1"
            >
              {sourceLabels[value]}
            </SizableText>
          ),
        }))}
        disabled={
          !aligned ||
          submitting ||
          !!review ||
          loadingSources ||
          !sourcesResult?.sources
        }
        onChange={(value: IInternalTransferSource) => {
          if (value === source) return;
          setSelectedSource(value);
          setSelectedTokenId(undefined);
          setAmount('');
          setError('');
        }}
      />
    );
  const tokenSelector = (
    <Select
      testID="perps-internal-transfer-token"
      title="Select token"
      placement="bottom-end"
      floatingPanelProps={
        inPage
          ? undefined
          : {
              width: tokenInputWidth || '$56',
              borderRadius: '$3',
            }
      }
      renderTrigger={({ onPress, label, disabled }) => (
        <Button
          testID="perps-internal-transfer-token-trigger"
          size={inPage ? 'medium' : 'small'}
          h={inPage ? 36 : 38}
          px="$3"
          borderRadius={inPage ? '$full' : '$2'}
          bg={inPage ? '$bgSubdued' : '$bgStrong'}
          iconAfter="ChevronDownSmallOutline"
          childrenAsText={false}
          accessibilityLabel="Token"
          disabled={disabled}
          onPress={onPress}
        >
          <XStack
            flex={inPage ? undefined : 1}
            alignItems="center"
            gap="$2"
            minWidth={0}
          >
            {asset ? (
              <Token
                size="xs"
                tokenImageUri={getHyperliquidTokenImageUrl(asset.symbol)}
              />
            ) : null}
            <SizableText
              size={inPage ? '$bodyLg' : '$bodyMd'}
              numberOfLines={1}
            >
              {label || 'Select token'}
            </SizableText>
          </XStack>
        </Button>
      )}
      placeholder="Select token"
      searchable={(tokens?.length ?? 0) > 6}
      searchPlaceholder="Search tokens"
      value={tokenId}
      items={(tokens ?? []).map((token) => ({
        value: token.id,
        label: getSpotTokenDisplayName(token.symbol),
        showSelectionIndicator: false,
        labelComponent: (
          <XStack alignItems="center" gap="$2.5" py="$1" minWidth={0}>
            <Token
              size="xs"
              tokenImageUri={getHyperliquidTokenImageUrl(token.symbol)}
            />
            <SizableText
              size={inPage ? '$bodyLgMedium' : '$bodyMdMedium'}
              color={token.id === tokenId ? '$textSuccess' : '$text'}
              flex={1}
              numberOfLines={1}
            >
              {getSpotTokenDisplayName(token.symbol)}
            </SizableText>
            <SizableText
              size={inPage ? '$bodyLgMedium' : '$bodyMdMedium'}
              color={token.id === tokenId ? '$textSuccess' : '$textSubdued'}
              numberOfLines={1}
            >
              {numberFormat(token.balance, {
                formatter: 'balance',
              })}
            </SizableText>
          </XStack>
        ),
        searchKeywords: [token.id, token.symbol],
      }))}
      disabled={!aligned || submitting || !!review || loadingTokens || !tokens}
      onChange={(value: string) => {
        if (value === tokenId) return;
        setSelectedTokenId(value);
        setAmount('');
        setError('');
      }}
    />
  );

  const mobileForm = selectingRecipient ? (
    <InternalTransferRecipientStep
      sender={account.expectedAccountAddress}
      search={recipientSearch}
      onChangeSearch={setRecipientSearch}
      recentRecipients={recentRecipients}
      disabled={!aligned || submitting || !!review}
      onSelect={({ address }) => {
        Keyboard.dismiss();
        setDestination(address);
        setError('');
        setMobileStep('amount');
      }}
    />
  ) : (
    <InternalTransferAmountStep
      amount={amount}
      onChangeAmount={setAmount}
      symbol={displaySymbol}
      sourceSelector={sourceSelector}
      tokenSelector={tokenSelector}
      maxAmount={maxAmount}
      onMax={() => maxAmount && setAmount(maxAmount)}
      maxDisabled={!maxAmount || !ready || Boolean(quoting) || !!review}
      disabled={!aligned || submitting || !!review}
      fee={quote?.fee}
      amountError={amountError}
    />
  );

  let pageTitle = 'Send tokens';
  if (!pending && !transferConfirmed) {
    pageTitle = selectingRecipient ? 'Send to' : 'Enter amount';
  }

  const reviewContent = review ? (
    <YStack gap="$3">
      {[
        {
          label: 'Amount',
          value: `${amount} ${getSpotTokenDisplayName(review.asset.symbol)}`,
        },
        { label: 'Account', value: sourceLabels[review.source] },
      ].map(({ label, value }) => (
        <XStack
          key={label}
          justifyContent="space-between"
          alignItems="center"
          gap="$4"
        >
          <SizableText size="$bodyMd" color="$textSubdued" flexShrink={0}>
            {label}
          </SizableText>
          <SizableText size="$bodyMdMedium" textAlign="right" flexShrink={1}>
            {value}
          </SizableText>
        </XStack>
      ))}
      <XStack justifyContent="space-between" alignItems="flex-start" gap="$4">
        <SizableText size="$bodyMd" color="$textSubdued" flexShrink={0}>
          From
        </SizableText>
        <SizableText
          size="$bodyMdMedium"
          fontFamily="$monoMedium"
          textAlign="right"
          flex={1}
          minWidth={0}
          maxWidth="60%"
          selectable
          style={{ wordBreak: 'break-all' }}
        >
          {account.expectedAccountAddress}
        </SizableText>
      </XStack>
      <XStack justifyContent="space-between" alignItems="flex-start" gap="$4">
        <SizableText size="$bodyMd" color="$textSubdued" flexShrink={0}>
          Recipient
        </SizableText>
        <SizableText
          size="$bodyMdMedium"
          fontFamily="$monoMedium"
          textAlign="right"
          flex={1}
          minWidth={0}
          maxWidth="60%"
          selectable
          style={{ wordBreak: 'break-all' }}
        >
          {review.destination}
        </SizableText>
      </XStack>
      {new BigNumber(review.fee).gt(0) ? (
        <>
          <XStack
            justifyContent="space-between"
            alignItems="flex-start"
            gap="$4"
          >
            <SizableText size="$bodyMd" color="$textSubdued" flexShrink={0}>
              Activation fee
            </SizableText>
            <SizableText
              size="$bodyMdMedium"
              textAlign="right"
              flex={1}
              minWidth={0}
            >
              {new BigNumber(review.fee).toFixed()} USD stablecoin
            </SizableText>
          </XStack>
          <SizableText size="$bodySm" color="$textSubdued">
            The activation fee is charged separately in stablecoin.
          </SizableText>
        </>
      ) : null}
      {review.userHasSentTx === false ? (
        <SizableText size="$bodySm" color="$textCaution">
          This recipient has never sent a transaction on Hyperliquid. Confirm
          that they control this address before sending.
        </SizableText>
      ) : null}
    </YStack>
  ) : null;

  const formGap = inPage ? '$5' : '$3';

  const content = (
    <YStack
      flex={inPage ? 1 : undefined}
      gap={review && !inPage ? '$4' : formGap}
      {...(selectingRecipient && { gap: '$0' })}
    >
      {inPage ? (
        <YStack mx="$-5">
          <Page.Header
            title={pageTitle}
            {...(platformEnv.isNativeIOS26Plus
              ? { unstable_headerLeftItems: buildNativeHeaderLeftItems }
              : { headerLeft: renderHeaderLeft })}
            headerRight={renderHeaderRight}
          />
        </YStack>
      ) : (
        <Dialog.Header
          title={review ? 'Review transfer' : 'Send tokens'}
          showExitButton={!submitting}
        />
      )}
      {!inPage && !transferConfirmed && !pending && !review ? (
        <SizableText size="$bodyMd" color="$textSubdued">
          Send to another address on Hyperliquid (HyperCore).
        </SizableText>
      ) : null}
      {!aligned ? (
        <SizableText color="$textCritical">
          The active account changed. Close and reopen this form.
        </SizableText>
      ) : null}
      {!transferConfirmed && pending ? (
        <YStack gap="$3">
          <SizableText size="$headingMd">
            Transfer not yet confirmed
          </SizableText>
          <SizableText>
            {pending.amount} {getSpotTokenDisplayName(pending.symbol ?? 'USDC')}
          </SizableText>
          <SizableText size="$bodySm" selectable>
            {pending.destination}
          </SizableText>
          <SizableText color="$textSubdued">
            The response was interrupted. This transfer may have succeeded.
            Check its status before sending again.
          </SizableText>
          <Button
            testID="perps-internal-transfer-check-status"
            loading={checkingStatus}
            disabled={!aligned || checkingStatus}
            onPress={() => void refreshStatus()}
          >
            Check status
          </Button>
          <Button
            testID="perps-internal-transfer-pending-history"
            variant="tertiary"
            onPress={history}
          >
            View history
          </Button>
        </YStack>
      ) : null}
      {!transferConfirmed && !pending ? (
        <>
          {!inPage ? reviewContent : null}
          {inPage ? mobileForm : null}
          {!review && !inPage ? (
            <>
              <YStack gap="$2">
                {recentRecipients.length ? (
                  <Select
                    testID="perps-internal-transfer-recents"
                    title="Recent recipients"
                    placement="bottom-start"
                    floatingPanelProps={
                      inPage
                        ? undefined
                        : {
                            width: recipientInputWidth || undefined,
                            borderRadius: '$3',
                            onOpenAutoFocus: (event) => event.preventDefault(),
                          }
                    }
                    value={destination.toLowerCase()}
                    disabled={!aligned || submitting || !!review}
                    items={inPage ? recentRecipientItems : undefined}
                    sections={
                      inPage
                        ? undefined
                        : [
                            {
                              title: 'Recent recipients',
                              data: recentRecipientItems,
                            },
                          ]
                    }
                    renderTrigger={({ onPress, disabled }) => (
                      <Input
                        {...recipientInputProps}
                        testID="perps-internal-transfer-recipient"
                        onPress={onPress}
                        addOns={[
                          {
                            renderContent: (
                              <IconButton
                                testID="perps-internal-transfer-recents-trigger"
                                icon="ChevronDownSmallOutline"
                                variant="tertiary"
                                size="small"
                                m="$0"
                                h={inPage ? 44 : 36}
                                w={inPage ? 44 : 36}
                                borderRadius="$2"
                                accessibilityLabel="Recent recipients"
                                disabled={disabled}
                                onPress={onPress}
                              />
                            ),
                          },
                        ]}
                      />
                    )}
                    onChange={(value: string) => {
                      setDestination(value);
                      setError('');
                    }}
                  />
                ) : (
                  <Input
                    {...recipientInputProps}
                    testID="perps-internal-transfer-recipient"
                  />
                )}
                {destination && addressError ? (
                  <SizableText color="$textCritical">
                    {addressError}
                  </SizableText>
                ) : null}
              </YStack>
              <XStack
                gap="$3"
                flexWrap="wrap"
                flexDirection={inPage ? 'column' : 'row'}
              >
                <YStack
                  gap="$2"
                  flex={1}
                  flexBasis={inPage ? 'auto' : 0}
                  minWidth={140}
                  onLayout={(event: LayoutChangeEvent) =>
                    setSourceInputWidth(event.nativeEvent.layout.width)
                  }
                >
                  {sourceSelector}
                </YStack>
                <YStack
                  gap="$2"
                  flex={1}
                  flexBasis={inPage ? 'auto' : 0}
                  minWidth={140}
                  onLayout={(event: LayoutChangeEvent) =>
                    setTokenInputWidth(event.nativeEvent.layout.width)
                  }
                >
                  {tokenSelector}
                </YStack>
              </XStack>
              <YStack gap="$2">
                <Input
                  testID="perps-internal-transfer-amount"
                  accessibilityLabel={
                    asset ? `Amount in ${displaySymbol}` : 'Amount'
                  }
                  {...transferInputProps}
                  size={inPage ? 'large' : 'medium'}
                  fontSize={inPage ? 16 : 14}
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="Amount"
                  keyboardType="decimal-pad"
                  disabled={!aligned || submitting || !!review}
                  addOns={[
                    {
                      renderContent: (
                        <Button
                          testID="perps-internal-transfer-max"
                          size="small"
                          variant="tertiary"
                          m="$0"
                          mr="$1"
                          h={inPage ? '$9' : '$7'}
                          alignSelf="center"
                          accessibilityLabel={
                            maxAmount && asset
                              ? `Use maximum amount: ${maxAmount} ${displaySymbol}`
                              : 'Use maximum amount'
                          }
                          disabled={!maxAmount || !ready || quoting || !!review}
                          onPress={() => maxAmount && setAmount(maxAmount)}
                        >
                          {!inPage && maxAmount && asset
                            ? `Max ${numberFormat(maxAmount, { formatter: 'balance' })} ${displaySymbol}`
                            : 'Max'}
                        </Button>
                      ),
                    },
                  ]}
                />
                {inPage && !review && maxAmount && asset ? (
                  <SizableText size="$bodySm" color="$textSubdued">
                    Available:{' '}
                    {numberFormat(maxAmount, { formatter: 'balance' })}{' '}
                    {displaySymbol}
                  </SizableText>
                ) : null}
                {amountError ? (
                  <SizableText size="$bodySm" color="$textCritical">
                    {amountError}
                  </SizableText>
                ) : null}
              </YStack>
            </>
          ) : null}
          {source && (!validSource || (review && review.source !== source)) ? (
            <SizableText color="$textCritical">
              The account mode changed. Select an account and review the
              transfer again.
            </SizableText>
          ) : null}
          {sourcesResult?.error ? (
            <>
              <SizableText color="$textCritical">
                {sourcesResult.error}
              </SizableText>
              <Button
                testID="perps-internal-transfer-retry-source"
                onPress={() => void refreshSources()}
              >
                Retry
              </Button>
            </>
          ) : null}
          {tokenError ? (
            <>
              <SizableText color="$textCritical">{tokenError}</SizableText>
              <Button
                testID="perps-internal-transfer-retry-tokens"
                onPress={() => void refreshTokens()}
              >
                Retry
              </Button>
            </>
          ) : null}
          {quoteError ? (
            <YStack gap="$2">
              <SizableText color="$textCritical">{quoteError}</SizableText>
              <Button
                testID="perps-internal-transfer-retry-quote"
                variant="tertiary"
                onPress={async () => {
                  await refreshSources();
                  await refreshTokens();
                  await refreshQuote();
                }}
              >
                Retry
              </Button>
            </YStack>
          ) : null}
          {status?.status === 'error' ? (
            <YStack gap="$2">
              <SizableText color="$textCritical">{status.message}</SizableText>
              <Button
                testID="perps-internal-transfer-retry-status"
                variant="tertiary"
                onPress={() => void refreshStatus()}
              >
                Check previous transfer
              </Button>
            </YStack>
          ) : null}
          {error ? (
            <SizableText color="$textCritical">{error}</SizableText>
          ) : null}
        </>
      ) : null}
      {inPage && review && !transferConfirmed && !pending ? (
        <DialogContainer
          open
          overlayLevel="modal"
          overlayPage={
            hostKey ? { hostKey, ownerKey: ownerKey ?? route.key } : undefined
          }
          title="Review transfer"
          showFooter={false}
          showExitButton={!submitting}
          disableDrag={submitting}
          disableSystemClose={submitting}
          onBeforeClose={() => !submittingRef.current}
          onClose={async () => {
            setReview(undefined);
          }}
          contentContainerProps={PERP_MOBILE_DIALOG_CONTENT_CONTAINER_PROPS}
          renderContent={
            <YStack gap="$4">
              {reviewContent}
              {!aligned ? (
                <SizableText color="$textCritical">
                  The active account changed. Close and reopen this form.
                </SizableText>
              ) : null}
              {confirmAction}
            </YStack>
          }
        />
      ) : null}
      {actions &&
        (inPage ? (
          <Page.Footer>
            <YStack
              px="$5"
              pt={platformEnv.isNative ? '$5' : '$4'}
              pb={platformEnv.isNativeAndroid ? '$8' : '$5'}
              gap="$2"
            >
              {platformEnv.isNative ? (
                <PerpsAmountKeypad
                  onKeyPress={(key) => {
                    if (!aligned || submitting || review) return;
                    if (key === 'backspace') {
                      setAmount(amount.slice(0, -1));
                    } else if (key === '.') {
                      if (!amount.includes('.')) {
                        setAmount(amount ? `${amount}.` : '0.');
                      }
                    } else {
                      setAmount(amount === '0' ? key : `${amount}${key}`);
                    }
                  }}
                  onBackspaceLongPress={() => {
                    if (aligned && !submitting && !review) setAmount('');
                  }}
                />
              ) : null}
              {actions}
            </YStack>
          </Page.Footer>
        ) : (
          actions
        ))}
    </YStack>
  );

  return inPage ? (
    content
  ) : (
    <DialogContainer
      ref={dialogRef}
      title={review ? 'Review transfer' : 'Send tokens'}
      showFooter={false}
      floatingPanelProps={{ width: review ? 400 : 480 }}
      onClose={() => Promise.resolve()}
      showExitButton={!submitting}
      disableSystemClose={submitting}
      onBeforeClose={() => !submittingRef.current}
      renderContent={content}
    />
  );
}

export default function InternalTransferModal() {
  const route =
    useRoute<
      RouteProp<IModalPerpParamList, EModalPerpRoutes.InternalTransfer>
    >();
  const navigation = useNavigation();
  return (
    <Page
      scrollEnabled
      scrollProps={{
        keyboardShouldPersistTaps: 'handled',
        keyboardDismissMode: 'on-drag',
        contentContainerStyle: { flexGrow: 1 },
      }}
    >
      <Page.Body px="$5" flex={1}>
        <InternalTransferContent
          account={route.params}
          onClose={() => navigation.goBack()}
          inPage
        />
      </Page.Body>
    </Page>
  );
}

export function showInternalTransferDialog(
  account: IInternalTransferAccount,
  dialogInTab: ReturnType<typeof useInTabDialog>,
) {
  const dialog = dialogInTab.show({
    dialogContainer: ({ ref }) => (
      <InternalTransferContent
        account={account}
        dialogRef={ref}
        onClose={() => {
          void dialog.close();
        }}
      />
    ),
  });
  return dialog;
}
