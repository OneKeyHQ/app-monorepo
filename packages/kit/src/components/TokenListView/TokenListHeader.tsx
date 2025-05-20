import { useIntl } from 'react-intl';

import { SizableText, Stack, XStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

type IProps = {
  filteredTokens: IAccountToken[];
  tableLayout?: boolean;
  onManageToken?: () => void;
  manageTokenEnabled?: boolean;
};

function TokenListHeader({ tableLayout }: IProps) {
  const intl = useIntl();

  return (
    <Stack testID="Wallet-Token-List-Header">
      {tableLayout ? (
        <XStack px="$5" py="$2" gap="$3">
          <XStack flexGrow={1} flexBasis={0} gap={89}>
            <SizableText
              flexGrow={1}
              flexBasis={0}
              color="$textSubdued"
              size="$headingSm"
            >
              {intl.formatMessage({ id: ETranslations.global_asset })}
            </SizableText>
            <SizableText
              flexGrow={1}
              flexBasis={0}
              // TODO: quick fix
              // should replace by Table Component
              pl={platformEnv.isNativeIOSPad ? 44 : undefined}
              color="$textSubdued"
              size="$headingSm"
            >
              {intl.formatMessage({ id: ETranslations.global_balance })}
            </SizableText>
          </XStack>
          <Stack w="$8" />
          <XStack flexGrow={1} flexBasis={0}>
            <SizableText
              flexGrow={1}
              flexBasis={0}
              // TODO: quick fix
              // should replace by Table Component
              pl={platformEnv.isNativeIOSPad ? 48 : undefined}
              color="$textSubdued"
              size="$headingSm"
            >
              {intl.formatMessage({ id: ETranslations.global_price })}
            </SizableText>
            <SizableText
              flexGrow={1}
              flexBasis={0}
              textAlign="right"
              color="$textSubdued"
              size="$headingSm"
            >
              {intl.formatMessage({ id: ETranslations.global_value })}
            </SizableText>
          </XStack>
        </XStack>
      ) : null}
    </Stack>
  );
}

export { TokenListHeader };
