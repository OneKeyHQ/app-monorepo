import { useIntl } from 'react-intl';

import { Icon, Popover, Stack } from '@onekeyhq/components';
import { FormatHyperlinkText } from '@onekeyhq/kit/src/components/HyperlinkText';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

export function SwapServiceFeeOverview(_props: {
  percentageFee?: number;
  percentOriginFee?: number;
}) {
  const intl = useIntl();
  const onekeyFeeHelpLink = useHelpLink({
    path: 'articles/13988593',
  });
  const content = `${intl.formatMessage({
    id: ETranslations.provider_popover_onekey_fee_content_nofee,
  })} <url>${onekeyFeeHelpLink}<underline>${intl.formatMessage({
    id: ETranslations.trade_incognito_read_more,
  })}</underline></url>`;
  return (
    <Popover
      title={intl.formatMessage({
        id: ETranslations.provider_ios_popover_onekey_fee,
      })}
      renderTrigger={
        <Icon
          name="InfoCircleOutline"
          size="$3.5"
          cursor="pointer"
          color="$iconSubdued"
        />
      }
      renderContent={
        <Stack p="$4">
          <FormatHyperlinkText
            autoExecuteParsedAction={false}
            onAction={openUrlExternal}
            size="$bodyMd"
            color="$textSubdued"
            urlTextProps={{
              color: '$textInfo',
            }}
            underlineTextProps={{
              color: '$textInfo',
            }}
          >
            {content}
          </FormatHyperlinkText>
        </Stack>
      }
    />
  );
}
