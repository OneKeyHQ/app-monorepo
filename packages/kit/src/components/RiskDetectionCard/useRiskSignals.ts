import { useMemo } from 'react';

import { isEmpty } from 'lodash';
import { useIntl } from 'react-intl';

import type { IUnsignedMessage } from '@onekeyhq/core/src/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  isPrimaryTypeOrderSign,
  isPrimaryTypePermitSign,
} from '@onekeyhq/shared/src/signMessage';
import type { IHostSecurity } from '@onekeyhq/shared/types/discovery';
import { EHostSecurityLevel } from '@onekeyhq/shared/types/discovery';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import { EParseTxComponentType } from '@onekeyhq/shared/types/signatureConfirm';
import type {
  IDisplayComponent,
  ISignatureConfirmDisplay,
} from '@onekeyhq/shared/types/signatureConfirm';

import { ERiskCheckCategory, ERiskSeverity } from './types';

import type { IRiskCheckItem, IRiskSignal } from './types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getHighestSeverity(
  signals: { severity: ERiskSeverity }[],
): ERiskSeverity {
  if (signals.some((s) => s.severity === ERiskSeverity.Critical)) {
    return ERiskSeverity.Critical;
  }
  if (signals.some((s) => s.severity === ERiskSeverity.Warning)) {
    return ERiskSeverity.Warning;
  }
  return ERiskSeverity.Info;
}

function buildCheckItem(
  category: ERiskCheckCategory,
  label: string,
  signals: IRiskSignal[],
): IRiskCheckItem {
  const passed = signals.length === 0;
  return {
    category,
    label,
    passed,
    signals,
    highestSeverity: passed ? undefined : getHighestSeverity(signals),
  };
}

// ---------------------------------------------------------------------------
// Collect signals from scattered sources
// ---------------------------------------------------------------------------

function hasSimulationComponent(
  displayComponents: IDisplayComponent[] | undefined,
): boolean {
  if (!displayComponents) return false;
  return displayComponents.some(
    (c) => c.type === EParseTxComponentType.Simulation,
  );
}

function hasAddressComponents(
  displayComponents: IDisplayComponent[] | undefined,
): boolean {
  if (!displayComponents) return false;
  return displayComponents.some(
    (c) => c.type === EParseTxComponentType.Address,
  );
}

function collectUrlSecuritySignals(
  urlSecurityInfo: IHostSecurity | undefined,
): IRiskSignal[] {
  if (!urlSecurityInfo?.alert) return [];
  if (urlSecurityInfo.level === EHostSecurityLevel.Security) return [];
  if (urlSecurityInfo.level === EHostSecurityLevel.Unknown) return [];

  const severity =
    urlSecurityInfo.level === EHostSecurityLevel.High
      ? ERiskSeverity.Critical
      : ERiskSeverity.Warning;

  return [
    {
      key: 'url-security',
      severity,
      title: urlSecurityInfo.alert,
    },
  ];
}

function collectMessageAlertSignals(
  alerts: string[] | undefined,
  isCritical: boolean,
): IRiskSignal[] {
  if (!alerts || isEmpty(alerts)) return [];
  return alerts.map((alert, idx) => ({
    key: `msg-alert-${idx}`,
    severity: isCritical ? ERiskSeverity.Critical : ERiskSeverity.Warning,
    title: alert,
  }));
}

function collectAddressTagSignals(
  displayComponents: IDisplayComponent[] | undefined,
): IRiskSignal[] {
  if (!displayComponents) return [];
  const signals: IRiskSignal[] = [];
  for (const component of displayComponents) {
    if (component.type === EParseTxComponentType.Address) {
      for (const tag of component.tags) {
        if (tag.displayType === 'critical' || tag.displayType === 'warning') {
          const severity =
            tag.displayType === 'critical'
              ? ERiskSeverity.Critical
              : ERiskSeverity.Warning;
          signals.push({
            key: `tag-${component.address}-${tag.value}`,
            severity,
            title: tag.value,
          });
        }
      }
    }
  }
  return signals;
}

// ---------------------------------------------------------------------------
// Hook for message confirmation pages
// ---------------------------------------------------------------------------
export function useMessageRiskChecks({
  unsignedMessage,
  messageDisplay,
  urlSecurityInfo,
  walletInternalSign,
  isRiskSignMethod,
  isConfirmationRequired,
  showContinueOperate,
  origin,
}: {
  unsignedMessage: IUnsignedMessage;
  messageDisplay: ISignatureConfirmDisplay | undefined;
  urlSecurityInfo?: IHostSecurity;
  walletInternalSign?: boolean;
  isRiskSignMethod: boolean;
  isConfirmationRequired?: boolean;
  showContinueOperate?: boolean;
  origin?: string;
}): IRiskCheckItem[] {
  const intl = useIntl();

  return useMemo(() => {
    const hasDAppOrigin = !!origin;

    if (walletInternalSign) {
      const checks: IRiskCheckItem[] = [];
      if (hasDAppOrigin) {
        checks.push(
          buildCheckItem(
            ERiskCheckCategory.SiteSecurity,
            intl.formatMessage({
              id: ETranslations.dapp_connect_site_security__title,
            }),
            [],
          ),
        );
      }
      checks.push(
        buildCheckItem(
          ERiskCheckCategory.TransactionAnalysis,
          intl.formatMessage({
            id: ETranslations.dapp_connect_transaction_analysis__title,
          }),
          [],
        ),
      );
      if (hasAddressComponents(messageDisplay?.components)) {
        checks.push(
          buildCheckItem(
            ERiskCheckCategory.AddressRisk,
            intl.formatMessage({
              id: ETranslations.dapp_connect_address_risk__title,
            }),
            [],
          ),
        );
      }
      return checks;
    }

    const checks: IRiskCheckItem[] = [];

    // 1. Site Security — only when DApp origin exists
    if (hasDAppOrigin) {
      const siteSignals = collectUrlSecuritySignals(urlSecurityInfo);
      checks.push(
        buildCheckItem(
          ERiskCheckCategory.SiteSecurity,
          intl.formatMessage({
            id: ETranslations.dapp_connect_site_security__title,
          }),
          siteSignals,
        ),
      );
    }

    // 2. Signature Analysis — when backend parsed message exists
    if (messageDisplay) {
      const isSafe = urlSecurityInfo?.level === EHostSecurityLevel.Security;
      const isDangerous =
        !isSafe &&
        (isConfirmationRequired ||
          !isEmpty(messageDisplay?.alerts) ||
          showContinueOperate);

      const signatureSignals: IRiskSignal[] = [];

      const isSignTypedDataV3orV4 =
        unsignedMessage.type === EMessageTypesEth.TYPED_DATA_V3 ||
        unsignedMessage.type === EMessageTypesEth.TYPED_DATA_V4;

      if (isSignTypedDataV3orV4) {
        const isPermit = isPrimaryTypePermitSign({ unsignedMessage });
        const isOrder = isPrimaryTypeOrderSign({ unsignedMessage });

        if (isPermit || isOrder) {
          signatureSignals.push({
            key: 'permit-sign',
            severity: isDangerous
              ? ERiskSeverity.Critical
              : ERiskSeverity.Warning,
            title: intl.formatMessage(
              { id: ETranslations.dapp_connect_permit_sign_alert },
              { type: isPermit ? 'permit' : 'order' },
            ),
          });
        } else if (!isSafe) {
          signatureSignals.push({
            key: 'typed-data-sign',
            severity: isDangerous ? ERiskSeverity.Critical : ERiskSeverity.Info,
            title: intl.formatMessage(
              { id: ETranslations.dapp_connect_permit_sign_alert },
              { type: 'signTypedData' },
            ),
          });
        }
      } else if (isRiskSignMethod) {
        signatureSignals.push({
          key: 'risk-sign-method',
          severity: ERiskSeverity.Critical,
          title: intl.formatMessage({
            id: ETranslations.dapp_connect_risk_sign,
          }),
        });
      }

      const alertSignals = collectMessageAlertSignals(
        messageDisplay.alerts,
        isDangerous ?? false,
      );
      const existingTitles = new Set(signatureSignals.map((s) => s.title));
      for (const s of alertSignals) {
        if (!existingTitles.has(s.title)) {
          signatureSignals.push(s);
        }
      }

      checks.push(
        buildCheckItem(
          ERiskCheckCategory.TransactionAnalysis,
          intl.formatMessage({
            id: ETranslations.dapp_connect_transaction_analysis__title,
          }),
          signatureSignals,
        ),
      );
    }

    // 3. Address Risk — when address components exist
    if (hasAddressComponents(messageDisplay?.components)) {
      const addressSignals = collectAddressTagSignals(
        messageDisplay?.components,
      );
      checks.push(
        buildCheckItem(
          ERiskCheckCategory.AddressRisk,
          intl.formatMessage({
            id: ETranslations.dapp_connect_address_risk__title,
          }),
          addressSignals,
        ),
      );
    }

    return checks;
  }, [
    walletInternalSign,
    urlSecurityInfo,
    isConfirmationRequired,
    messageDisplay,
    showContinueOperate,
    unsignedMessage,
    isRiskSignMethod,
    intl,
    origin,
  ]);
}

// ---------------------------------------------------------------------------
// Hook for transaction confirmation pages
// ---------------------------------------------------------------------------
export function useTxRiskChecks({
  decodedTxAlerts,
  urlSecurityInfo,
  displayComponents,
  origin,
}: {
  decodedTxAlerts: string[];
  urlSecurityInfo?: IHostSecurity;
  displayComponents?: IDisplayComponent[];
  origin?: string;
}): IRiskCheckItem[] {
  const intl = useIntl();

  return useMemo(() => {
    const checks: IRiskCheckItem[] = [];

    // 1. Site Security — only when DApp origin exists
    if (origin) {
      const siteSignals = collectUrlSecuritySignals(urlSecurityInfo);
      checks.push(
        buildCheckItem(
          ERiskCheckCategory.SiteSecurity,
          intl.formatMessage({
            id: ETranslations.dapp_connect_site_security__title,
          }),
          siteSignals,
        ),
      );
    }

    // 2. Transaction Simulation — when simulation component exists
    if (hasSimulationComponent(displayComponents)) {
      checks.push(
        buildCheckItem(
          ERiskCheckCategory.TransactionSimulation,
          intl.formatMessage({
            id: ETranslations.dapp_connect_transaction_simulation__title,
          }),
          [],
        ),
      );
    }

    // 3. Transaction Analysis — always present (backend always parses tx)
    const txSignals: IRiskSignal[] = [];
    for (let i = 0; i < decodedTxAlerts.length; i += 1) {
      txSignals.push({
        key: `tx-alert-${i}`,
        severity: ERiskSeverity.Warning,
        title: decodedTxAlerts[i],
      });
    }
    checks.push(
      buildCheckItem(
        ERiskCheckCategory.TransactionAnalysis,
        intl.formatMessage({
          id: ETranslations.dapp_connect_transaction_analysis__title,
        }),
        txSignals,
      ),
    );

    // 4. Address Risk — when address components exist
    if (hasAddressComponents(displayComponents)) {
      const addressSignals = collectAddressTagSignals(displayComponents);
      checks.push(
        buildCheckItem(
          ERiskCheckCategory.AddressRisk,
          intl.formatMessage({
            id: ETranslations.dapp_connect_address_risk__title,
          }),
          addressSignals,
        ),
      );
    }

    return checks;
  }, [decodedTxAlerts, urlSecurityInfo, displayComponents, intl, origin]);
}
