import { useEffect, useState } from 'react';

import { Button, Page, SizableText, Stack, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { WALLET_TYPE_WATCHING } from '@onekeyhq/shared/src/consts/dbConsts';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EUniversalSearchType } from '@onekeyhq/shared/types/search';

import { HomePageView } from '../HomePageView';

import { UrlAccountAutoReplaceHistory } from './UrlAccountAutoReplaceHistory';
import { getPrevUrlAccount, urlAccountNavigation } from './urlAccountUtils';

const sceneName = EAccountSelectorSceneName.homeUrlAccount;

function UrlAccountPage() {
  return (
    <>
      <HomePageView key={sceneName} sceneName={sceneName} />
      <UrlAccountAutoReplaceHistory num={0} />
    </>
  );
}

function UrlAccountAutoCreate({ redirectMode }: { redirectMode?: boolean }) {
  const route = useAppRoute();
  const navigation = useAppNavigation();
  const routeParams = route.params as
    | { address: string; networkId?: string }
    | undefined;
  const actions = useAccountSelectorActions();
  const [urlAccountStatus, setUrlAccountStatus] = useState<
    'ok' | 'invalid' | undefined
  >();

  useEffect(() => {
    setTimeout(async () => {
      let networkId = routeParams?.networkId;
      let networkCode = routeParams?.networkId;
      let routeAddress = routeParams?.address;
 
      const fixNetworkParams = (network: IServerNetwork | undefined) => {
        if (network) {
          networkId = network.id;
          networkCode = network.code;
        }
      };

      // eslint-disable-next-line spellcheck/spell-checker
      // not full url like: /0x63ac73816EeB38514DaE6c46008baf55f1c59C9e
      if (!routeAddress && networkId) {
        routeAddress = networkId;
        networkId = undefined;
        networkCode = undefined;
        const result = await backgroundApiProxy.serviceApp.universalSearch({
          input: routeAddress,
          searchTypes: [EUniversalSearchType.Address],
        });
        const firstAddressItemPayload =
          result?.[EUniversalSearchType.Address]?.items?.[0]?.payload;
        if (firstAddressItemPayload) {
          const { network } = firstAddressItemPayload;
          fixNetworkParams(network);
        }
      }

      let hasError = false;
      // routeParams?.networkId may be networkCode
      let network = await backgroundApiProxy.serviceNetwork.getNetworkSafe({
        code: networkCode,
      });
      if (network) {
        fixNetworkParams(network);
      } else {
        network = await backgroundApiProxy.serviceNetwork.getNetworkSafe({
          networkId,
        });
        if (network) {
          fixNetworkParams(network);
        }
      }
      if (!networkId || !routeAddress) {
        hasError = true;
      }
      const prevAccount = getPrevUrlAccount();

   

      if (
        networkId &&
        routeAddress &&
        (routeAddress?.toLowerCase() !== prevAccount?.address?.toLowerCase() ||
          networkId !== prevAccount?.networkId)
      ) {
        try {
          const r = await backgroundApiProxy.serviceAccount.addWatchingAccount({
            input: routeAddress,
            networkId,
            deriveType: undefined,
            isUrlAccount: true,
          });

          void actions.current.updateSelectedAccountForSingletonAccount({
            num: 0,
            networkId,
            walletId: WALLET_TYPE_WATCHING,
            othersWalletAccountId: r.accounts[0].id,
          });
        } catch (error) {
          console.error('UrlAccountAutoCreate error: ', error);
          Toast.error({
            title: `Unsupported address or network: ${routeAddress}`,
          });
          hasError = true;
        }
      }

      if (hasError) {
        setUrlAccountStatus('invalid');
      } else {
        setUrlAccountStatus('ok');
        if (redirectMode) {
          // replace Landing to Home first to make sure history back & forward works
          urlAccountNavigation.replaceHomePage(navigation);
          if (routeAddress) {
            await timerUtils.wait(1);
            urlAccountNavigation.pushUrlAccountPage(navigation, {
              address: routeAddress,
              networkId: networkCode,
            });
          }
        }
      }
    }, 0);
  }, [
    actions,
    navigation,
    redirectMode,
    routeParams,
    routeParams?.address,
    routeParams?.networkId,
  ]);

  if (urlAccountStatus === 'invalid') {
    return (
      <Page>
        <Stack p="$6">
          <SizableText my="$6">Sorry, something went wrong!</SizableText>
          {process.env.NODE_ENV !== 'production' ? (
            <SizableText my="$6">{JSON.stringify(routeParams)}</SizableText>
          ) : null}
          <Button
            onPress={() => {
              urlAccountNavigation.replaceHomePage(navigation);
            }}
          >
            Back to Home
          </Button>
        </Stack>
      </Page>
    );
  }

  // render directly if not redirectMode
  if (urlAccountStatus === 'ok' && !redirectMode) {
    return <UrlAccountPage />;
  }

  return (
    <Page>
      <SizableText my="$6">loading.....</SizableText>
    </Page>
  );
}

export function UrlAccountPageContainer() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <UrlAccountAutoCreate />
    </AccountSelectorProviderMirror>
  );
}

export function UrlAccountLanding() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <UrlAccountAutoCreate redirectMode />
    </AccountSelectorProviderMirror>
  );
}
