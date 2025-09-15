import { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  IconButton,
  LinearGradient,
  Popover,
  SizableText,
  Stack,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { NetworkAvatar } from '@onekeyhq/kit/src/components/NetworkAvatar';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { useThemeVariant } from '@onekeyhq/kit/src/hooks/useThemeVariant';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import { useTokenDetailsContext } from './TokenDetailsContext';

type IProps = {
  tokens: IAccountToken[];
  onSelected: (token: IAccountToken) => void;
};

function TokenDetailsTabToolbar(props: IProps) {
  const { gtMd } = useMedia();
  const { tokens, onSelected } = props;
  const themeVariant = useThemeVariant();
  const intl = useIntl();
  const { tokenDetails } = useTokenDetailsContext();
  const [settings] = useSettingsPersistAtom();
  const renderContent = useCallback(
    ({ closePopover }: { closePopover: () => void }) => {
      return (
        <Stack
          pb="$2"
          $gtMd={{
            gap: '$0.5',
            py: '$1.5',
          }}
        >
          {tokens.map((token) => {
            const tokenDetailKey = `${token.accountId ?? ''}_${
              token.networkId ?? ''
            }`;
            const tokenDetail = tokenDetails[tokenDetailKey]?.data;

            return (
              <ListItem
                key={token.$key}
                userSelect="none"
                onPress={async () => {
                  closePopover();
                  onSelected(token);
                }}
                $gtMd={{
                  px: '$1.5',
                  mx: '$1.5',
                  py: 5,
                  minHeight: 0,
                  gap: '$2',
                }}
              >
                <NetworkAvatar
                  networkId={token.networkId}
                  {...(gtMd && {
                    size: '$4',
                  })}
                />
                <SizableText
                  size="$bodyLg"
                  $gtMd={{
                    size: '$bodyMd',
                  }}
                  flex={1}
                >
                  {token.networkName}
                </SizableText>
                <ListItem.Text
                  align="right"
                  primary={
                    <NumberSizeableTextWrapper
                      hideValue
                      size="$bodyLg"
                      $gtMd={{
                        size: '$bodyMd',
                      }}
                      color="$textSubdued"
                      formatter="value"
                      formatterOptions={{
                        currency: settings.currencyInfo.symbol,
                      }}
                    >
                      {tokenDetail?.fiatValue ?? '-'}
                    </NumberSizeableTextWrapper>
                  }
                />
              </ListItem>
            );
          })}
        </Stack>
      );
    },
    [tokens, tokenDetails, gtMd, settings.currencyInfo.symbol, onSelected],
  );

  if (tokens.length <= 1) {
    return null;
  }

  const shouldShowToolbar = gtMd ? tokens.length > 5 : tokens.length > 3;

  if (!shouldShowToolbar) {
    return null;
  }

  return (
    <XStack pr="$5">
      <LinearGradient
        colors={
          themeVariant === 'light'
            ? ['rgba(255,255,255,0)', 'rgba(255,255,255,1)']
            : ['rgba(15,15,15,0)', 'rgba(15,15,15,1)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        position="absolute"
        w="$5"
        left="$-5"
        top={0}
        bottom={0}
      />
      <Popover
        placement="bottom-end"
        floatingPanelProps={{
          width: 320,
          maxHeight: 372,
        }}
        sheetProps={{
          snapPoints: [92],
          snapPointsMode: 'percent',
        }}
        title={intl.formatMessage({
          id: ETranslations.global_select_network,
        })}
        renderTrigger={
          <IconButton variant="tertiary" icon="ChevronDownSmallOutline" />
        }
        renderContent={renderContent}
      />
    </XStack>
  );
}

export default memo(TokenDetailsTabToolbar);
