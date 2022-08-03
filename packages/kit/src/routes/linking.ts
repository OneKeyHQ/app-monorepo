// @ts-ignore
import getPathFromStateDefault from '@react-navigation/core/lib/module/getPathFromState.js';
import { LinkingOptions } from '@react-navigation/native';
import { createURL } from 'expo-linking';
import { toLower } from 'lodash';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ManageNetworkRoutes } from '../views/ManageNetworks/types';
import { ManageTokenRoutes } from '../views/ManageTokens/types';
import { SendRoutes } from '../views/Send/types';

import { ModalRoutes, RootRoutes } from './routesEnum';

const prefix = createURL('/');

const blackList: string[] = [];
function isBlackListLinkingUrl(url: string) {
  return Boolean(
    blackList.find((item) => toLower(url).startsWith(toLower(item))),
  );
}

const whiteList = [
  `/${RootRoutes.Modal}/${ModalRoutes.DappConnectionModal}`,
  `/${RootRoutes.Modal}/${ModalRoutes.ManageNetwork}/${ManageNetworkRoutes.SwitchNetwork}`,
  `/${RootRoutes.Modal}/${ModalRoutes.ManageNetwork}/${ManageNetworkRoutes.AddNetworkConfirm}`,
  `/${RootRoutes.Modal}/${ModalRoutes.ManageToken}/${ManageTokenRoutes.AddToken}`,
  `/${RootRoutes.Modal}/${ModalRoutes.Send}/${SendRoutes.SendConfirmFromDapp}`,
];
function isWhiteListLinkingUrl(url: string) {
  return Boolean(
    whiteList.find((item) => toLower(url).startsWith(toLower(item))),
  );
}

let enableLinkingRoute =
  platformEnv.isDev || platformEnv.isNative || platformEnv.isExtension;

// firefox: popup window trigger resize issue
if (platformEnv.isExtensionUiPopup && platformEnv.isRuntimeFirefox) {
  enableLinkingRoute = false;
}
// firefox: router back auto-reload navigation issue
//        may be caused by @react-navigation+native+6.0.6.patch
if (platformEnv.isExtFirefox) {
  enableLinkingRoute = false;
}

const linking: LinkingOptions<any> = {
  enabled: enableLinkingRoute,
  prefixes: [prefix],
  // not working for web
  filter(url) {
    if (!url) {
      return true;
    }
    return !isBlackListLinkingUrl(url);
  },
  // remove url query if not in white list
  getPathFromState(state, options) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const url = getPathFromStateDefault(state, options) as string;

    if (isWhiteListLinkingUrl(url)) {
      return url;
    }

    if (isBlackListLinkingUrl(url)) {
      const urlRemovedQuery = url.split('?')[0] || '';
      return urlRemovedQuery;
    }

    const urlRemovedQuery = url.split('?')[0] || '';
    return urlRemovedQuery;
  },
};

export default linking;
