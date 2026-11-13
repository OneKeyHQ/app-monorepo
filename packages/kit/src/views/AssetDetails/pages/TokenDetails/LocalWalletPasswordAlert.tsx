import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, Icon, SizableText, XStack } from '@onekeyhq/components';
import type { IDialogInstance } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  confirmLocalWalletVerify,
  useLocalWalletPasswordVerify,
} from './LocalWalletFrozenLines';

type ILocalWalletPasswordAlertPresentation = 'inline' | 'tokenDetails';

export function LocalWalletPasswordAlertContent({
  amount,
  presentation = 'inline',
  isVerifying,
  onVerify,
  ownerKey = 'preview',
}: {
  amount: string;
  presentation?: ILocalWalletPasswordAlertPresentation;
  isVerifying: boolean;
  onVerify: () => Promise<void>;
  ownerKey?: string;
}) {
  const intl = useIntl();
  const [isConfirming, setIsConfirming] = useState(false);
  const isCard = presentation !== 'inline';
  const owner = useMemo<{
    mounted: boolean;
    key: string;
    dialog?: IDialogInstance;
  }>(() => ({ mounted: true, key: ownerKey }), [ownerKey]);
  const currentOwnerRef = useRef(owner);
  currentOwnerRef.current = owner;
  useEffect(() => {
    owner.mounted = true;
    setIsConfirming(false);
    return () => {
      owner.mounted = false;
      const dialog = owner.dialog;
      owner.dialog = undefined;
      void dialog?.close();
    };
  }, [owner]);
  const isCurrentOwner = useCallback(
    () => owner.mounted && currentOwnerRef.current === owner,
    [owner],
  );
  const handleVerify = useCallback(async () => {
    if (!isCurrentOwner() || owner.dialog?.isExist()) return;
    if (isCard) {
      setIsConfirming(true);
      try {
        const confirmed = await confirmLocalWalletVerify({
          intl,
          amount,
          onDevice: false,
          titleId: ETranslations.privacy_balance_verification__title,
          descriptionId: ETranslations.privacy_balance_verification__desc,
          isCurrent: isCurrentOwner,
          onOpen: (dialog) => {
            owner.dialog = dialog;
          },
        });
        if (!confirmed) return;
      } finally {
        owner.dialog = undefined;
        if (isCurrentOwner()) setIsConfirming(false);
      }
    }
    if (!isCurrentOwner()) return;
    await onVerify();
  }, [amount, intl, isCurrentOwner, isCard, onVerify, owner]);

  return (
    <XStack
      testID="privacy-password-alert"
      alignItems="center"
      gap={isCard ? '$3' : '$2'}
      {...(isCard
        ? {
            bg: '$bgSubdued',
            borderRadius: '$3',
            p: '$4',
            minHeight: '$16',
            mb: '$4',
          }
        : {})}
    >
      <Icon
        name={isCard ? 'InfoCircleOutline' : 'LockOutline'}
        size={isCard ? '$5' : '$4'}
        flexShrink={0}
        color={isCard ? '$iconSubdued' : '$iconCaution'}
      />
      <SizableText
        size={isCard ? '$bodyMdMedium' : '$bodySm'}
        color={isCard ? '$text' : '$textCaution'}
        flexShrink={1}
        flex={isCard ? 1 : undefined}
      >
        {isCard
          ? intl.formatMessage({
              id: ETranslations.privacy_balance_verification_pending__msg,
            })
          : intl.formatMessage(
              { id: ETranslations.privacy_balance_needs_verifying__msg },
              { amount },
            )}
      </SizableText>
      <Button
        testID="privacy-password-verify"
        size="small"
        variant={isCard ? 'secondary' : 'tertiary'}
        m={0}
        flexShrink={0}
        loading={isVerifying}
        disabled={isVerifying || isConfirming}
        onPress={handleVerify}
      >
        {intl.formatMessage({
          id: ETranslations.privacy_balance_verify__action,
        })}
      </Button>
    </XStack>
  );
}

// Shown wherever the balance is read when part of it waits for the password.
export function LocalWalletPasswordAlert({
  networkId,
  accountId,
  presentation,
  onVerified,
}: {
  networkId: string;
  accountId: string;
  presentation?: ILocalWalletPasswordAlertPresentation;
  onVerified?: () => void;
}) {
  const ownerKey = `${networkId}:${accountId}`;
  const { result, run } = usePromiseResult(async () => {
    const [balance, network] = await Promise.all([
      backgroundApiProxy.servicePrivacyChain.getLocalWalletAccountBalance({
        networkId,
        accountId,
      }),
      backgroundApiProxy.serviceNetwork.getNetwork({ networkId }),
    ]);
    const part = balance?.frozen?.find(
      ({ reason }) => reason === 'needsPassword',
    );
    return part
      ? { ownerKey, amount: `${part.amountParsed} ${network.symbol}` }
      : undefined;
  }, [accountId, networkId, ownerKey]);
  useEffect(() => {
    const refresh = () => {
      void run();
    };
    appEventBus.on(EAppEventBusNames.RefreshTokenList, refresh);
    return () => {
      appEventBus.off(EAppEventBusNames.RefreshTokenList, refresh);
    };
  }, [run]);
  const { isVerifying, verify } = useLocalWalletPasswordVerify({
    networkId,
    accountId,
    onVerified: () => {
      void run();
      onVerified?.();
    },
  });

  if (!result || result.ownerKey !== ownerKey) {
    return null;
  }
  return (
    <LocalWalletPasswordAlertContent
      amount={result.amount}
      presentation={presentation}
      isVerifying={isVerifying}
      onVerify={verify}
      ownerKey={ownerKey}
    />
  );
}
