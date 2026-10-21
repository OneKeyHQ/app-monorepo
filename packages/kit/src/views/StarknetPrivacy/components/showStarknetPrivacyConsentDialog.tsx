import { useCallback, useState } from 'react';

import type { ICheckedState } from '@onekeyhq/components';
import { Checkbox, Dialog, SizableText, YStack } from '@onekeyhq/components';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IStrk20PrivacyNetworkConfig } from '@onekeyhq/shared/types/starknetPrivacy';

import { formatMockMessage } from '../utils/starknetPrivacyUtils';

import type { IntlShape } from 'react-intl';

function ConsentStatement({ text }: { text: string }) {
  return (
    <SizableText size="$bodyMd" color="$textSubdued">
      {text}
    </SizableText>
  );
}

function StarknetPrivacyConsentContent({
  intl,
  config,
  protocolFee,
  onConfirm,
}: {
  intl: IntlShape;
  config?: IStrk20PrivacyNetworkConfig;
  /** STRK, read from chain; the fee line is left out while it is unknown. */
  protocolFee?: string;
  onConfirm: () => Promise<void>;
}) {
  const [acknowledged, setAcknowledged] = useState<ICheckedState>(false);

  const handleConfirm = useCallback(
    () =>
      new Promise<void>((resolve, reject) => {
        onConfirm()
          .then(() => resolve())
          .catch(() =>
            reject(new Error('Starknet privacy consent confirmation failed')),
          );
      }),
    [onConfirm],
  );

  const auditorKey = config?.auditorPublicKey;

  return (
    <YStack gap="$5">
      <YStack gap="$3">
        <ConsentStatement
          text={formatMockMessage(
            intl,
            ETranslationsMock.starknet_privacy_consent_viewing_key,
          )}
        />
        <YStack gap="$1">
          <ConsentStatement
            text={formatMockMessage(
              intl,
              ETranslationsMock.starknet_privacy_consent_registration,
            )}
          />
          {auditorKey ? (
            <SizableText size="$bodySm" color="$textSubdued">
              {formatMockMessage(
                intl,
                ETranslationsMock.starknet_privacy_consent_auditor_key,
                { key: accountUtils.shortenAddress({ address: auditorKey }) },
              )}
            </SizableText>
          ) : null}
        </YStack>
        <ConsentStatement
          text={formatMockMessage(
            intl,
            ETranslationsMock.starknet_privacy_consent_withdrawals,
          )}
        />
        {protocolFee ? (
          <ConsentStatement
            text={formatMockMessage(
              intl,
              ETranslationsMock.starknet_privacy_consent_fee,
              { amount: protocolFee },
            )}
          />
        ) : null}
        <ConsentStatement
          text={formatMockMessage(
            intl,
            ETranslationsMock.starknet_privacy_opt_out_note,
          )}
        />
      </YStack>

      <Checkbox
        testID="starknet-privacy-consent-checkbox"
        labelContainerProps={{ flex: 1 }}
        label={formatMockMessage(
          intl,
          ETranslationsMock.starknet_privacy_consent_acknowledge,
        )}
        value={acknowledged}
        onChange={setAcknowledged}
        labelProps={{ variant: '$bodyMdMedium' }}
      />

      <Dialog.Footer
        onConfirm={handleConfirm}
        onConfirmText={intl.formatMessage({ id: ETranslations.global_confirm })}
        onCancelText={intl.formatMessage({ id: ETranslations.global_cancel })}
        confirmButtonProps={{ disabled: !acknowledged }}
      />
    </YStack>
  );
}

export function showStarknetPrivacyConsentDialog({
  intl,
  config,
  protocolFee,
}: {
  intl: IntlShape;
  config?: IStrk20PrivacyNetworkConfig;
  protocolFee?: string;
}): Promise<boolean> {
  return new Promise((resolve) => {
    let confirmed = false;
    const dialog = Dialog.show({
      icon: 'InfoCircleOutline',
      title: formatMockMessage(
        intl,
        ETranslationsMock.starknet_privacy_consent_title,
      ),
      showFooter: false,
      onClose: () => resolve(confirmed),
      renderContent: (
        <StarknetPrivacyConsentContent
          intl={intl}
          config={config}
          protocolFee={protocolFee}
          onConfirm={async () => {
            confirmed = true;
            await dialog.close();
          }}
        />
      ),
    });
  });
}
