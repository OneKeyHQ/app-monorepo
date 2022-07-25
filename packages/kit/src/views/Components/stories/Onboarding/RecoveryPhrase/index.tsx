import React, { FC, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Box, Icon, Text } from '@onekeyhq/components';

import Layout from '../Layout';

import SecondaryContent from './SecondaryContent';

type RecoveryPhraseProps = {
  visible?: boolean;
  onPressBackButton?: () => void;
  onPressShowPhraseButton?: () => void;
  onPressSavedPhrase?: () => void;
};

const defaultProps = {} as const;

const getListItemLeadingColor = (type: string) => {
  if (type === 'critical')
    return {
      bgColor: 'surface-critical-default',
      iconColor: 'icon-critical',
    } as const;
  if (type === 'warning')
    return {
      bgColor: 'surface-warning-default',
      iconColor: 'icon-warning',
    } as const;

  return {
    bgColor: 'decorative-surface-one',
    iconColor: 'decorative-icon-one',
  } as const;
};

const RecoveryPhrase: FC<RecoveryPhraseProps> = ({
  visible,
  onPressBackButton,
  onPressShowPhraseButton,
  onPressSavedPhrase,
}) => {
  const intl = useIntl();

  const lists = useMemo(
    () =>
      [
        {
          type: 'decorative',
          icon: 'LockClosedOutline',
          para: intl.formatMessage({ id: 'modal__attention_unlock' }),
        },
        {
          type: 'decorative',
          icon: 'DotsCircleHorizontalOutline',
          para: intl.formatMessage({ id: 'content__recovery_phrase_restore' }),
        },
        {
          type: 'critical',
          icon: 'EyeOffOutline',
          para: intl.formatMessage({ id: 'modal__attention_shh' }),
        },
        {
          type: 'warning',
          icon: 'ShieldCheckOutline',
          para: intl.formatMessage({
            id: 'backup__manual_backup_warning_never_ask',
          }),
        },
      ] as const,
    [intl],
  );

  return (
    <>
      <Layout
        title={intl.formatMessage({ id: 'title__recovery_phrase' })}
        description={intl.formatMessage({ id: 'title__recovery_phrase_desc' })}
        secondaryContent={
          <SecondaryContent
            onPressShowPhraseButton={onPressShowPhraseButton}
            onPressSavedPhrase={onPressSavedPhrase}
          />
        }
        fullHeight
        visible={visible}
        onPressBackButton={onPressBackButton}
      >
        <Box my={-3} mt={{ base: 4, sm: 0 }}>
          {lists.map((item, index) => (
            <Box key={index} flexDir="row" alignItems="center" py={3}>
              <Box
                p={2.5}
                mr={4}
                rounded="full"
                bgColor={getListItemLeadingColor(item.type)?.bgColor}
                alignSelf="flex-start"
              >
                <Icon
                  name={item.icon}
                  color={getListItemLeadingColor(item.type)?.iconColor}
                  size={20}
                />
              </Box>
              <Text flex={1} typography="Body2">
                {item.para}
              </Text>
            </Box>
          ))}
        </Box>
      </Layout>
    </>
  );
};

RecoveryPhrase.defaultProps = defaultProps;

export default RecoveryPhrase;
