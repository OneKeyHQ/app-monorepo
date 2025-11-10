import type { RefObject } from 'react';
import { useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  HeightTransition,
  Page,
  SegmentControl,
  TextAreaInput,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IOnboardingParamListV2 } from '@onekeyhq/shared/src/routes';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { fixInputImportSingleChain } from '../../Onboarding/pages/ImportWallet/ImportSingleChainBase';
import { OnboardingLayout } from '../components/OnboardingLayout';
import { PhaseInputArea } from '../components/PhaseInputArea';

import type { IPhaseInputAreaInstance } from '../components/PhaseInputArea';

export default function ImportWatchedAccountV2() {
  const navigation = useAppNavigation();
  const [selected, setSelected] = useState<'address' | 'publicKey'>('address');
  const { gtMd } = useMedia();
  const phaseInputAreaRef = useRef<IPhaseInputAreaInstance | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const intl = useIntl();
  const [address, setAddress] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const isConfirmDisabled = useMemo(() => {
    if (selected === 'address' && !address?.trim()) {
      return true;
    }
    if (selected === 'publicKey' && !publicKey?.trim()) {
      return true;
    }
    return false;
  }, [address, publicKey, selected]);

  const handleConfirm = async () => {
    try {
      setIsConfirming(true);
      await timerUtils.wait(600);
      if (selected === 'address') {
        const input = address?.trim() || '';
        const results =
          await backgroundApiProxy.serviceNetwork.detectNetworksByAddress({
            address: input,
          });
        const params: IOnboardingParamListV2[EOnboardingPagesV2.SelectPrivateKeyNetwork] =
          {
            input,
            detectedNetworks: results.detectedNetworks,
            importType: 'address',
          };
        void navigation.push(
          EOnboardingPagesV2.SelectPrivateKeyNetwork,
          params,
        );
      } else {
        const publicKeyTrimmed = publicKey?.trim?.() || '';
        const input =
          await backgroundApiProxy.servicePassword.encodeSensitiveText({
            text: publicKeyTrimmed,
          });
        const results =
          await backgroundApiProxy.serviceNetwork.detectNetworksByPublicKey({
            publicKey: input,
          });
        const params: IOnboardingParamListV2[EOnboardingPagesV2.SelectPrivateKeyNetwork] =
          {
            input,
            detectedNetworks: results.detectedNetworks,
            importType: 'publicKey',
          };
        void navigation.push(
          EOnboardingPagesV2.SelectPrivateKeyNetwork,
          params,
        );
      }
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header
          title={intl.formatMessage({
            id: ETranslations.global_import_address,
          })}
        />
        <OnboardingLayout.Body constrained={false}>
          <OnboardingLayout.ConstrainedContent gap="$5">
            <SegmentControl
              value={selected}
              fullWidth
              options={[
                {
                  label: intl.formatMessage({
                    id: ETranslations.global_address,
                  }),
                  value: 'address',
                },
                {
                  label: intl.formatMessage({
                    id: ETranslations.global_public_key,
                  }),
                  value: 'publicKey',
                },
              ]}
              onChange={(value) =>
                setSelected(value as 'address' | 'publicKey')
              }
            />
            <HeightTransition>
              {selected === 'address' ? (
                <YStack
                  key="address"
                  animation="quick"
                  animateOnly={['opacity']}
                  enterStyle={{
                    opacity: 0,
                  }}
                  gap="$5"
                >
                  <TextAreaInput
                    allowPaste
                    allowClear
                    allowSecureTextEye
                    size="large"
                    numberOfLines={5}
                    value={address}
                    onChangeText={setAddress}
                    $platform-native={{
                      minHeight: 160,
                    }}
                    placeholder={intl.formatMessage({
                      id: ETranslations.form_address_placeholder,
                    })}
                  />
                </YStack>
              ) : (
                <YStack
                  key="publicKey"
                  animation="quick"
                  animateOnly={['opacity']}
                  enterStyle={{
                    opacity: 0,
                  }}
                  gap="$5"
                >
                  <TextAreaInput
                    allowPaste
                    allowClear
                    allowSecureTextEye
                    size="large"
                    numberOfLines={5}
                    value={publicKey}
                    onChangeText={setPublicKey}
                    $platform-native={{
                      minHeight: 160,
                    }}
                    placeholder={intl.formatMessage({
                      id: ETranslations.form_public_key_placeholder,
                    })}
                  />
                </YStack>
              )}
            </HeightTransition>
            {gtMd ? (
              <Button
                disabled={isConfirmDisabled}
                size="large"
                variant="primary"
                onPress={handleConfirm}
                loading={isConfirming}
              >
                {intl.formatMessage({ id: ETranslations.global_confirm })}
              </Button>
            ) : null}
          </OnboardingLayout.ConstrainedContent>
        </OnboardingLayout.Body>
        {!gtMd ? (
          <OnboardingLayout.Footer>
            <Button
              disabled={isConfirmDisabled}
              size="large"
              variant="primary"
              onPress={handleConfirm}
              loading={isConfirming}
              w="100%"
            >
              {intl.formatMessage({ id: ETranslations.global_confirm })}
            </Button>
          </OnboardingLayout.Footer>
        ) : null}
      </OnboardingLayout>
    </Page>
  );
}
