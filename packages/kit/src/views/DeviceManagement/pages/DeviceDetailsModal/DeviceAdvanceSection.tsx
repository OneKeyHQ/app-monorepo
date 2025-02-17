import { useIntl } from 'react-intl';

import { SizableText, Switch, XStack, YStack } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function DeviceAdvanceSection({
  passphraseEnabled,
  pinOnAppEnabled,
  onPassphraseEnabledChange,
  onPinOnAppEnabledChange,
  inputPinOnSoftwareSupport,
}: {
  passphraseEnabled: boolean;
  pinOnAppEnabled: boolean;
  onPassphraseEnabledChange: (value: boolean) => void;
  onPinOnAppEnabledChange: (value: boolean) => void;
  inputPinOnSoftwareSupport: boolean;
}) {
  const intl = useIntl();
  return (
    <YStack gap="$1">
      <XStack ai="center" h="$9">
        <SizableText size="$headingSm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.global_advance,
          })}
        </SizableText>
      </XStack>
      <YStack py="$1" bg="$bgSubdued" borderRadius="$4">
        <ListItem
          alignItems="flex-start"
          title={intl.formatMessage({
            id: ETranslations.global_passphrase,
          })}
          subtitle={intl.formatMessage({
            id: ETranslations.global_passphrase_desc,
          })}
        >
          <Switch
            size="small"
            value={passphraseEnabled}
            onChange={() => {
              onPassphraseEnabledChange(!passphraseEnabled);
            }}
          />
        </ListItem>
        {inputPinOnSoftwareSupport ? (
          <ListItem
            title={intl.formatMessage({
              id: ETranslations.enter_pin_on_app,
            })}
          >
            <Switch
              size="small"
              value={pinOnAppEnabled}
              onChange={() => {
                onPinOnAppEnabledChange(!pinOnAppEnabled);
              }}
            />
          </ListItem>
        ) : null}
      </YStack>
    </YStack>
  );
}

export default DeviceAdvanceSection;
