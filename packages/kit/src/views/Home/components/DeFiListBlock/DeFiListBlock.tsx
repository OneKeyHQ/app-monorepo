import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { NumberSizeableText, Stack, useMedia } from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { RichBlock } from '../RichBlock/RichBlock';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

function DeFiListBlock() {
  const intl = useIntl();
  const media = useMedia();
  const [settings] = useSettingsPersistAtom();

  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });

  usePromiseResult(async () => {
    if (!account || !network) {
      return;
    }

    if (networkUtils.isAllNetwork({ networkId: network.id })) {
      return;
    }

    await backgroundApiProxy.serviceDeFi.abortFetchAccountDeFiPositions();

    const resp = await backgroundApiProxy.serviceDeFi.fetchAccountDeFiPositions(
      {
        accountId: account.id,
        networkId: network.id,
        accountAddress: account.address,
      },
    );
  }, [account, network]);

  const renderSubTitle = useCallback(() => {
    if (media.gtMd) {
      return (
        <NumberSizeableText
          size="$headingXl"
          color="$textSubdued"
          formatter="value"
          formatterOptions={{
            currency: settings.currencyInfo.symbol,
          }}
        >
          123
        </NumberSizeableText>
      );
    }

    return null;
  }, [media.gtMd, settings.currencyInfo.symbol]);
  const renderContent = useCallback(() => {
    return 'defi list';
  }, []);
  return (
    <RichBlock
      withTitleSeparator
      title={intl.formatMessage({ id: ETranslations.global_earn })}
      subTitle={renderSubTitle()}
      content={renderContent()}
    />
  );
}

export { DeFiListBlock };
