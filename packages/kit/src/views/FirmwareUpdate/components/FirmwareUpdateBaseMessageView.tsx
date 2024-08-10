import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Icon,
  RichSizeableText,
  SizableText,
  Stack,
} from '@onekeyhq/components';
import type { IRichSizeableTextProps } from '@onekeyhq/components';
import type { IKeyOfIcons } from '@onekeyhq/components/src/primitives';
import { FIRMWARE_CONTACT_US_URL } from '@onekeyhq/shared/src/config/appConfig';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { ColorTokens } from 'tamagui';

type IToneType = 'destructive' | 'warning' | 'success';

const getColors = (
  tone?: IToneType,
): {
  iconWrapperBg: ColorTokens;
  iconColor: ColorTokens;
} => {
  switch (tone) {
    case 'destructive': {
      return {
        iconWrapperBg: '$bgCritical',
        iconColor: '$iconCritical',
      };
    }
    case 'warning': {
      return {
        iconWrapperBg: '$bgCaution',
        iconColor: '$iconCaution',
      };
    }
    case 'success': {
      return {
        iconWrapperBg: '$bgSuccess',
        iconColor: '$iconSuccess',
      };
    }
    default: {
      return {
        iconWrapperBg: '$bgStrong',
        iconColor: '$icon',
      };
    }
  }
};

function UpdateErrorTroubleshooting() {
  const intl = useIntl();

  let messageIntlKey;
  if (platformEnv.isNative) {
    messageIntlKey = ETranslations.update_troubleshoot_connection_issues_mobile;
  } else if (platformEnv.isDesktop) {
    messageIntlKey =
      ETranslations.update_troubleshoot_connection_issues_desktop;
  } else {
    messageIntlKey = ETranslations.update_troubleshoot_connection_issues;
  }

  const message = intl.formatMessage({
    id: messageIntlKey,
    defaultMessage:
      'If you have any questions, please refer to the troubleshooting guide.',
  });

  const textLines = message.split('\n');

  return (
    <Stack>
      {textLines.map((text, index) => {
        if (text.includes('<url>')) {
          return (
            <RichSizeableText
              key={index}
              size="$bodyMd"
              color="$textSubdued"
              linkList={{
                url: { url: FIRMWARE_CONTACT_US_URL },
              }}
            >
              {text}
            </RichSizeableText>
          );
        }

        return (
          <SizableText key={index} size="$bodyMd" color="$textSubdued">
            {text}
          </SizableText>
        );
      })}
    </Stack>
  );
}

export function FirmwareUpdateBaseMessageView({
  icon,
  title,
  tone,
  message,
  linkList,
  displayTroubleshooting,
}: {
  icon?: IKeyOfIcons;
  title?: string;
  tone?: IToneType;
  message?: IRichSizeableTextProps['children'];
  linkList?: IRichSizeableTextProps['linkList'];
  displayTroubleshooting?: boolean;
}) {
  const renderIcon = useCallback(
    () =>
      icon?.endsWith('Solid') ? (
        <Icon name={icon} size="$14" color={getColors(tone).iconColor} />
      ) : (
        <Stack
          alignSelf="flex-start"
          p="$3"
          borderRadius="$full"
          bg={getColors(tone).iconWrapperBg}
        >
          <Icon name={icon} size="$7" color={getColors(tone).iconColor} />
        </Stack>
      ),
    [icon, tone],
  );
  return (
    <Stack py="$6" gap="$5">
      <Stack>
        {icon ? renderIcon() : null}
        {title ? (
          <SizableText my="$4" size="$heading2xl">
            {title}
          </SizableText>
        ) : null}
        {message ? (
          <RichSizeableText
            size="$bodyLg"
            color="$textSubdued"
            linkList={linkList}
          >
            {message}
          </RichSizeableText>
        ) : null}
      </Stack>

      {displayTroubleshooting ? <UpdateErrorTroubleshooting /> : null}
    </Stack>
  );
}
