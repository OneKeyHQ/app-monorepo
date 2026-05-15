import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ActionList } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import {
  EModalSignAndVerifyRoutes,
  type IModalSignAndVerifyParamList,
} from '@onekeyhq/shared/src/routes/signAndVerify';

type ISignAndVerifyMessageParams =
  IModalSignAndVerifyParamList[EModalSignAndVerifyRoutes.SignAndVerifyMessage];

const SIGN_AND_VERIFY_ROUTE_PROBE = '[sign-and-verify][CRASH_PROBE]';
const MAX_PROBE_KEYS = 24;
const MAX_PROBE_ARRAY_ITEMS = 8;

function getProbeObject(value: unknown): Record<string, unknown> | null {
  if (
    (typeof value === 'object' && value !== null) ||
    typeof value === 'function'
  ) {
    return value as Record<string, unknown>;
  }
  return null;
}

function getConstructorName(value: unknown) {
  const objectValue = getProbeObject(value);
  if (!objectValue) {
    return '';
  }
  const constructorValue = (
    objectValue as {
      constructor?: unknown;
    }
  ).constructor;
  if (typeof constructorValue === 'function') {
    return constructorValue.name || 'anonymous';
  }
  if (constructorValue === undefined) {
    return 'undefined';
  }
  return `nonFunction:${typeof constructorValue}`;
}

function getPrototypeName(value: object) {
  const proto = Object.getPrototypeOf(value);
  if (proto === null) {
    return 'null';
  }
  if (proto === Object.prototype) {
    return 'Object.prototype';
  }
  if (proto === Array.prototype) {
    return 'Array.prototype';
  }
  return getConstructorName(proto) || typeof proto;
}

function describeToStringDescriptor(descriptor?: PropertyDescriptor) {
  if (!descriptor) {
    return 'none';
  }

  const parts: string[] = [];
  parts.push(descriptor.enumerable ? 'enumerable' : 'nonEnumerable');
  parts.push(descriptor.configurable ? 'configurable' : 'nonConfigurable');
  if ('writable' in descriptor) {
    parts.push(descriptor.writable ? 'writable' : 'readonly');
  }
  if ('value' in descriptor) {
    parts.push(`value:${typeof descriptor.value}`);
  }
  if ('get' in descriptor) {
    parts.push(`get:${typeof descriptor.get}`);
  }
  if ('set' in descriptor) {
    parts.push(`set:${typeof descriptor.set}`);
  }
  return parts.join('/');
}

function describeFieldValue(key: string, value: unknown) {
  if (value === null) {
    return `${key}:null`;
  }

  const valueType = typeof value;
  const objectValue = getProbeObject(value);
  if (!objectValue) {
    return `${key}:${valueType}`;
  }

  const hasOwnToString = Object.prototype.hasOwnProperty.call(
    objectValue,
    'toString',
  );
  const toStringType = typeof (
    objectValue as {
      toString?: unknown;
    }
  ).toString;

  return [
    `${key}:${valueType}`,
    `ctor:${getConstructorName(value)}`,
    `proto:${getPrototypeName(value as object)}`,
    `toString:${toStringType}`,
    hasOwnToString ? 'ownToString:true' : 'ownToString:false',
  ].join('/');
}

function describeProbeValue(name: string, value: unknown) {
  try {
    if (value === null) {
      return `${name}{type=null}`;
    }

    const valueType = typeof value;
    const objectValue = getProbeObject(value);
    if (!objectValue) {
      return `${name}{type=${valueType}}`;
    }

    const keys = Object.keys(objectValue);
    const ownToString = Object.prototype.hasOwnProperty.call(
      objectValue,
      'toString',
    );
    const toStringValue = (
      objectValue as {
        toString?: unknown;
      }
    ).toString;
    const toStringDescriptor = Object.getOwnPropertyDescriptor(
      objectValue,
      'toString',
    );
    const fields = keys
      .slice(0, MAX_PROBE_KEYS)
      .map((key) => describeFieldValue(key, objectValue[key]));

    return [
      `${name}{type=${valueType}`,
      `ctor=${getConstructorName(value)}`,
      `proto=${getPrototypeName(value as object)}`,
      `array=${Array.isArray(value)}`,
      `keys=${keys.slice(0, MAX_PROBE_KEYS).join(',')}`,
      `keysLength=${keys.length}`,
      `typeofToString=${typeof toStringValue}`,
      `ownToString=${ownToString}`,
      `toStringDesc=${describeToStringDescriptor(toStringDescriptor)}`,
      `fields=${fields.join(',')}}`,
    ].join(';');
  } catch (error) {
    return `${name}{probeError=${
      error instanceof Error ? error.message : String(error)
    }}`;
  }
}

function getProbeStack() {
  return (
    new Error(SIGN_AND_VERIFY_ROUTE_PROBE).stack
      ?.split('\n')
      .slice(1, 8)
      .map((line) => line.trim())
      .join(' <- ') || 'unavailable'
  );
}

function logSignAndVerifyRouteProbe(params: ISignAndVerifyMessageParams) {
  const deriveInfoItemLines = params.deriveInfoItems
    .slice(0, MAX_PROBE_ARRAY_ITEMS)
    .map((item, index) =>
      describeProbeValue(`params.deriveInfoItems[${index}]`, item),
    );
  const message = [
    `${SIGN_AND_VERIFY_ROUTE_PROBE} before pushModal`,
    describeProbeValue('params', params),
    describeProbeValue('params.deriveInfoItems', params.deriveInfoItems),
    ...deriveInfoItemLines,
    `stack=${getProbeStack()}`,
  ].join(' | ');

  try {
    console.error(message);
    defaultLogger.app.error.log(message);
  } catch (error) {
    console.error(
      `${SIGN_AND_VERIFY_ROUTE_PROBE} logger failed`,
      error instanceof Error ? error.message : String(error),
    );
  }
}

export function WalletActionSignAndVerify({
  onClose,
}: {
  onClose: () => void;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { activeAccount } = useActiveAccount({ num: 0 });

  const {
    network,
    account,
    wallet,
    indexedAccount,
    deriveInfoItems,
    deriveType,
    isOthersWallet,
  } = activeAccount;

  const displaySignAndVerify = usePromiseResult(async () => {
    const signAccounts =
      await backgroundApiProxy.serviceInternalSignAndVerify.getSignAccounts({
        networkId: network?.id ?? '',
        accountId: account?.id ?? '',
        indexedAccountId: indexedAccount?.id ?? '',
        isOthersWallet,
      });
    return signAccounts.length > 0;
  }, [account?.id, indexedAccount?.id, isOthersWallet, network?.id]);

  const handleSignAndVerify = useCallback(async () => {
    if (!network?.id || !wallet?.id) {
      return;
    }
    const params: ISignAndVerifyMessageParams = {
      networkId: network.id,
      accountId: account?.id,
      walletId: wallet.id,
      indexedAccountId: indexedAccount?.id,
      deriveInfoItems,
      deriveType,
      isOthersWallet,
    };
    logSignAndVerifyRouteProbe(params);
    navigation.pushModal(EModalRoutes.SignAndVerifyModal, {
      screen: EModalSignAndVerifyRoutes.SignAndVerifyMessage,
      params,
    });
    onClose();
  }, [
    navigation,
    onClose,
    account,
    deriveInfoItems,
    deriveType,
    indexedAccount,
    isOthersWallet,
    network,
    wallet,
  ]);

  if (!displaySignAndVerify.result) {
    return null;
  }

  return (
    <ActionList.Item
      trackID="wallet-action-sign-and-verify"
      icon="SignatureOutline"
      label={intl.formatMessage({
        id: ETranslations.message_signing_main_title,
      })}
      onClose={() => {}}
      onPress={handleSignAndVerify}
    />
  );
}
