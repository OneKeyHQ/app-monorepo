import { useCallback, useState } from 'react';

import { useIntl } from 'react-intl';

import { Icon, SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

type ILidoFAQProps = {
  question: string;
  answer: string;
};

const LidoFAQ = ({ question, answer }: ILidoFAQProps) => {
  const [show, setShow] = useState(false);
  const onToggle = useCallback(() => setShow((v) => !v), []);
  return (
    <YStack>
      <YStack>
        <XStack mb="$2" onPress={onToggle}>
          <XStack flex={1}>
            <SizableText size="$headingMd">{question}</SizableText>
          </XStack>
          <XStack>
            <Icon
              name={show ? 'ChevronTopSmallOutline' : 'ChevronDownSmallOutline'}
            />
          </XStack>
        </XStack>
        <XStack>
          {show ? <SizableText size="$bodyMd">{answer}</SizableText> : null}
        </XStack>
      </YStack>
    </YStack>
  );
};

export const EthLidoFAQs = () => {
  const intl = useIntl();
  return (
    <YStack mt="$12">
      <XStack mb="$5">
        <SizableText size="$headingLg">
          {intl.formatMessage({ id: ETranslations.global_faqs })}
        </SizableText>
      </XStack>
      <YStack space="$5">
        <LidoFAQ
          question={intl.formatMessage({
            id: ETranslations.earn_how_does_the_lido_protocol_work,
          })}
          answer={intl.formatMessage({
            id: ETranslations.earn_how_does_the_lido_protocol_work_desc,
          })}
        />
        <LidoFAQ
          question={intl.formatMessage({
            id: ETranslations.earn_why_do_you_receive_steth,
          })}
          answer={intl.formatMessage({
            id: ETranslations.earn_why_do_you_receive_steth_desc,
          })}
        />
        <LidoFAQ
          question={intl.formatMessage({
            id: ETranslations.earn_what_is_the_possible_risk_of_lido,
          })}
          answer={intl.formatMessage({
            id: ETranslations.earn_what_is_the_possible_risk_of_lido_desc,
          })}
        />
      </YStack>
    </YStack>
  );
};

export const MaticLidoFAQs = () => {
  const intl = useIntl();
  return (
    <YStack mt="$12">
      <XStack mb="$5">
        <SizableText size="$headingLg">
          {intl.formatMessage({ id: ETranslations.global_faqs })}
        </SizableText>
      </XStack>
      <YStack space="$5">
        <LidoFAQ
          question={intl.formatMessage({
            id: ETranslations.earn_how_does_the_lido_protocol_work,
          })}
          answer={intl.formatMessage({
            id: ETranslations.earn_how_does_the_lido_protocol_work_desc,
          })}
        />
        <LidoFAQ
          question={intl.formatMessage({
            id: ETranslations.earn_why_do_you_receive_stmatic,
          })}
          answer={intl.formatMessage({
            id: ETranslations.earn_why_do_you_receive_stmatic_desc,
          })}
        />
        <LidoFAQ
          question={intl.formatMessage({
            id: ETranslations.earn_what_is_the_possible_risk_of_lido,
          })}
          answer={intl.formatMessage({
            id: ETranslations.earn_what_is_the_possible_risk_of_lido_desc,
          })}
        />
      </YStack>
    </YStack>
  );
};
