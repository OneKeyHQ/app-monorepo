import { useCallback, useState } from 'react';

import type { ICheckedState } from '@onekeyhq/components';
import {
  Button,
  Checkbox,
  Dialog,
  IconButton,
  SizableText,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import { ETranslations, ETranslationsMock } from '@onekeyhq/shared/src/locale';
import type { IStrk20PrivacyNetworkConfig } from '@onekeyhq/shared/types/starknetPrivacy';

import { formatMockMessage } from '../utils/starknetPrivacyUtils';

import type { IntlShape } from 'react-intl';

function ConsentStatement({ text, title }: { text: string; title?: string }) {
  return (
    <YStack gap="$1">
      {title ? <SizableText size="$bodyMdMedium">{title}</SizableText> : null}
      <SizableText size="$bodySm" color="$textSubdued">
        {text}
      </SizableText>
    </YStack>
  );
}

function StarknetPrivacyConsentContent({
  intl,
  config,
  protocolFee,
  isResuming = false,
  onConfirm,
}: {
  intl: IntlShape;
  config?: IStrk20PrivacyNetworkConfig;
  /** Current fee in STRK, read from chain. */
  protocolFee?: string;
  isResuming?: boolean;
  onConfirm: () => Promise<void>;
}) {
  const [acknowledged, setAcknowledged] = useState<ICheckedState>(false);
  const [showDetails, setShowDetails] = useState(false);
  const { copyText } = useClipboard();

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
  const feeBlock = (
    <YStack bg="$bgSubdued" borderRadius="$3" p="$3" gap="$1">
      <SizableText size="$bodySm" color="$textSubdued">
        {formatMockMessage(
          intl,
          ETranslationsMock.starknet_privacy_consent_fee_label,
        )}
      </SizableText>
      <SizableText testID="starknet-privacy-consent-fee" size="$headingMd">
        {protocolFee !== undefined
          ? formatMockMessage(
              intl,
              ETranslationsMock.starknet_privacy_consent_fee,
              { amount: protocolFee },
            )
          : intl.formatMessage({ id: ETranslations.global_not_available })}
      </SizableText>
    </YStack>
  );
  const feeContent = isResuming ? (
    <YStack bg="$bgSubdued" borderRadius="$3" p="$3">
      <SizableText testID="starknet-privacy-resume-no-fee" size="$bodyMdMedium">
        {formatMockMessage(
          intl,
          ETranslationsMock.starknet_privacy_resume_no_fee,
        )}
      </SizableText>
    </YStack>
  ) : (
    feeBlock
  );

  return (
    <YStack testID="starknet-privacy-consent" gap="$5">
      <YStack gap="$4">
        <ConsentStatement
          title={formatMockMessage(
            intl,
            ETranslationsMock.starknet_privacy_consent_visibility_title,
          )}
          text={formatMockMessage(
            intl,
            ETranslationsMock.starknet_privacy_consent_visibility,
          )}
        />
        {!isResuming ? (
          <ConsentStatement
            title={formatMockMessage(
              intl,
              ETranslationsMock.starknet_privacy_consent_registration_title,
            )}
            text={formatMockMessage(
              intl,
              ETranslationsMock.starknet_privacy_consent_registration,
            )}
          />
        ) : null}
        <ConsentStatement
          text={formatMockMessage(
            intl,
            ETranslationsMock.starknet_privacy_consent_public_activity,
          )}
        />
      </YStack>

      {feeContent}

      <YStack gap="$3">
        <Button
          testID="starknet-privacy-consent-details-toggle"
          size="small"
          variant="tertiary"
          alignSelf="flex-start"
          iconAfter={
            showDetails ? 'ChevronTopOutline' : 'ChevronDownSmallOutline'
          }
          accessibilityState={{ expanded: showDetails }}
          onPress={() => setShowDetails((value) => !value)}
        >
          {intl.formatMessage({ id: ETranslations.global_details })}
        </Button>
        {showDetails ? (
          <YStack testID="starknet-privacy-consent-details" gap="$3">
            <ConsentStatement
              text={formatMockMessage(
                intl,
                ETranslationsMock.starknet_privacy_consent_viewing_key,
              )}
            />
            <ConsentStatement
              text={formatMockMessage(
                intl,
                ETranslationsMock.starknet_privacy_consent_withdrawals,
              )}
            />
            {auditorKey ? (
              <YStack gap="$1">
                <XStack
                  justifyContent="space-between"
                  alignItems="center"
                  gap="$2"
                >
                  <SizableText size="$bodySmMedium">
                    {formatMockMessage(
                      intl,
                      ETranslationsMock.starknet_privacy_consent_auditor_key_label,
                    )}
                  </SizableText>
                  <IconButton
                    testID="starknet-privacy-consent-auditor-key-copy"
                    icon="Copy3Outline"
                    size="small"
                    variant="tertiary"
                    accessibilityLabel={intl.formatMessage({
                      id: ETranslations.global_copy,
                    })}
                    onPress={() => copyText(auditorKey)}
                  />
                </XStack>
                <SizableText
                  testID="starknet-privacy-consent-auditor-key"
                  size="$bodySm"
                  color="$textSubdued"
                  userSelect="text"
                  $platform-web={{ wordBreak: 'break-all' }}
                >
                  {auditorKey}
                </SizableText>
              </YStack>
            ) : null}
          </YStack>
        ) : null}
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
        onConfirmText={intl.formatMessage({
          id: isResuming
            ? ETranslations.global_resume
            : ETranslations.global_continue,
        })}
        onCancelText={intl.formatMessage({ id: ETranslations.global_cancel })}
        confirmButtonProps={{
          testID: 'starknet-privacy-consent-continue',
          disabled: acknowledged !== true,
        }}
      />
    </YStack>
  );
}

export function showStarknetPrivacyConsentDialog({
  intl,
  config,
  protocolFee,
  isResuming = false,
}: {
  intl: IntlShape;
  config?: IStrk20PrivacyNetworkConfig;
  protocolFee?: string;
  isResuming?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    let confirmed = false;
    const dialog = Dialog.show({
      icon: 'InfoCircleOutline',
      title: formatMockMessage(
        intl,
        isResuming
          ? ETranslationsMock.starknet_privacy_resume_sync
          : ETranslationsMock.starknet_privacy_consent_title,
      ),
      showFooter: false,
      onClose: () => resolve(confirmed),
      renderContent: (
        <StarknetPrivacyConsentContent
          intl={intl}
          config={config}
          protocolFee={protocolFee}
          isResuming={isResuming}
          onConfirm={async () => {
            confirmed = true;
            await dialog.close();
          }}
        />
      ),
    });
  });
}
