import {
  DescriptionList,
  Dialog,
  Divider,
  SizableText,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type {
  ICexDepositWarningAction,
  ICexDepositWarningPage,
  ISendCexDepositWarningContext,
} from '@onekeyhq/shared/src/logger/scopes/transaction/types';
import {
  getCexDepositWarningExchange,
  getCexDepositWarningFacts,
  isCexDepositExplicitlyDisabled,
} from '@onekeyhq/shared/src/utils/cexDepositSupportUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { ICexSupportedInfo } from '@onekeyhq/shared/types/address';

import type { IntlShape } from 'react-intl';

const FACT_VALUE_TEXT_PROPS = {
  color: '$text',
  numberOfLines: 2,
} as const;

function getCexDepositWarningAction(flag?: string): ICexDepositWarningAction {
  if (flag === 'confirm') {
    return 'continue';
  }
  if (flag === 'cancel') {
    return 'back';
  }
  return 'close';
}

function CexDepositWarningContent({
  tokenSymbol,
  networkName,
  networkLabel,
  exchangeName,
  exchangeLabel,
  body,
}: {
  tokenSymbol?: string;
  networkName?: string;
  networkLabel: string;
  exchangeName: string;
  exchangeLabel: string;
  body: string;
}) {
  const subject = [tokenSymbol, networkName].filter(Boolean).join(' · ');

  return (
    <YStack gap="$4">
      <YStack
        testID="cex-deposit-unsupported-summary"
        gap="$2"
        p="$4"
        bg="$bgSubdued"
        borderRadius="$3"
        borderCurve="continuous"
        accessibilityLabel={
          subject ? `${subject} → ${exchangeName}` : exchangeName
        }
      >
        {tokenSymbol ? (
          <SizableText size="$headingMd">{tokenSymbol}</SizableText>
        ) : null}
        {tokenSymbol ? <Divider /> : null}
        <DescriptionList gap="$2.5">
          {networkName ? (
            <DescriptionList.Item>
              <DescriptionList.Item.Key>
                {networkLabel}
              </DescriptionList.Item.Key>
              <DescriptionList.Item.Value textProps={FACT_VALUE_TEXT_PROPS}>
                {networkName}
              </DescriptionList.Item.Value>
            </DescriptionList.Item>
          ) : null}
          <DescriptionList.Item>
            <DescriptionList.Item.Key>{exchangeLabel}</DescriptionList.Item.Key>
            <DescriptionList.Item.Value textProps={FACT_VALUE_TEXT_PROPS}>
              {exchangeName}
            </DescriptionList.Item.Value>
          </DescriptionList.Item>
        </DescriptionList>
      </YStack>
      <SizableText size="$bodyLg" color="$textSubdued">
        {body}
      </SizableText>
    </YStack>
  );
}

function showCexDepositUnsupportedDialog({
  intl,
  networkId,
  tokenSymbol,
  networkName,
  exchangeLabel,
  page,
}: {
  intl: IntlShape;
  networkId: string;
  tokenSymbol?: string;
  networkName?: string;
  exchangeLabel?: string;
  page: ICexDepositWarningPage;
}): Promise<boolean> {
  const fallbackExchangeLabel = intl.formatMessage({
    id: ETranslations.exchange__title,
  });
  const facts = getCexDepositWarningFacts({
    tokenSymbol,
    networkName,
    exchangeLabel,
    fallbackExchangeLabel,
  });
  const trackingContext: ISendCexDepositWarningContext = {
    network: networkId,
    tokenSymbol: facts.tokenSymbol,
    exchange: getCexDepositWarningExchange(exchangeLabel),
    page,
  };

  return new Promise<boolean>((resolve) => {
    let settled = false;
    function settle(flag?: string) {
      if (settled) {
        return;
      }
      settled = true;
      defaultLogger.transaction.send.sendCexDepositWarningAction({
        ...trackingContext,
        action: getCexDepositWarningAction(flag),
      });
      resolve(flag === 'confirm');
    }

    defaultLogger.transaction.send.sendCexDepositWarningShow(trackingContext);

    Dialog.show({
      icon: 'ShieldOutline',
      tone: 'warning',
      title: intl.formatMessage({
        id: ETranslations.cex_deposit_may_not_be_supported__title,
      }),
      renderContent: (
        <CexDepositWarningContent
          tokenSymbol={facts.tokenSymbol}
          networkName={facts.networkName}
          networkLabel={intl.formatMessage({
            id: ETranslations.global_network,
          })}
          exchangeName={facts.exchangeName}
          exchangeLabel={fallbackExchangeLabel}
          body={intl.formatMessage({
            id: ETranslations.cex_deposit_may_not_be_supported__desc,
          })}
        />
      ),
      onConfirmText: intl.formatMessage({
        id: ETranslations.global_continue,
      }),
      onCancelText: intl.formatMessage({
        id: ETranslations.global_back,
      }),
      onConfirm: async ({ close }) => {
        await close?.({ flag: 'confirm' });
      },
      onCancel: (close) => {
        void close();
      },
      onClose: (extra) => {
        settle(extra?.flag);
      },
      confirmButtonProps: {
        testID: 'cex-deposit-unsupported-confirm-btn',
        variant: 'secondary',
      },
      cancelButtonProps: {
        testID: 'cex-deposit-unsupported-cancel-btn',
        variant: 'primary',
      },
      footerProps: {
        flexDirection: 'row-reverse',
        $md: {
          flexDirection: 'column',
        },
      },
    });
  });
}

export async function confirmCexDepositIfUnsupported({
  intl,
  isNFT,
  networkId,
  tokenSymbol,
  networkName,
  page,
  cexSupportedInfo,
  hasAcknowledgedWarning,
}: {
  intl: IntlShape;
  isNFT?: boolean;
  networkId: string;
  tokenSymbol?: string;
  networkName?: string;
  page: ICexDepositWarningPage;
  cexSupportedInfo?: ICexSupportedInfo;
  hasAcknowledgedWarning?: boolean;
}): Promise<{ canProceed: boolean; hasAcknowledgedWarning: boolean }> {
  if (hasAcknowledgedWarning) {
    return { canProceed: true, hasAcknowledgedWarning: true };
  }
  if (isNFT || networkUtils.isLightningNetworkByNetworkId(networkId)) {
    return { canProceed: true, hasAcknowledgedWarning: false };
  }
  if (!isCexDepositExplicitlyDisabled(cexSupportedInfo?.depositEnable)) {
    return { canProceed: true, hasAcknowledgedWarning: false };
  }

  const confirmed = await showCexDepositUnsupportedDialog({
    intl,
    networkId,
    tokenSymbol,
    networkName,
    exchangeLabel: cexSupportedInfo?.cexLabel,
    page,
  });
  return { canProceed: confirmed, hasAcknowledgedWarning: confirmed };
}
