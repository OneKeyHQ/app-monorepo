/* eslint-disable @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access */
import React, { FC, useCallback, useEffect, useMemo, useRef } from 'react';

import { IJsonRpcRequest } from '@onekeyfe/cross-inpage-provider-types';

import { Box, Button } from '@onekeyhq/components';

export function CardanoProvider() {
  const handler = useCallback(async (payload: IJsonRpcRequest) => {
    console.log('CardanoProvider Recive Message: ', payload);
    console.log('params: ', JSON.stringify(payload.params));

    switch (payload.method) {
      case 'Cardano_composeTxPlan': {
        console.log('Cardano_composeTxPlan');
        break;
      }
      case 'Cardano_signTransaction': {
        console.log('Cardano_signTransaction');
        break;
      }
      default:
        break;
    }

    if (payload.method === 'callCardanoWebEmbedMethod') {
      await window.$onekey.$private.request({
        method: 'cardanoWebEmbedResponse',
        promiseId: (payload.params as any).promiseId,
        data: {
          txHash: '123321',
        },
      });
    }
  }, []);

  useEffect(() => {
    console.log('will Register !');
    console.log('window.$onekey: ', window.$onekey);
    if (!window.$onekey) {
      return;
    }
    console.log('Register Message Handler for $private');
    window.$onekey.$private.on('message_low_level', handler);
    return () => {
      console.log('cancel registe');
      window.$onekey.$private.off('message_low_level', handler);
    };
  }, [handler]);

  return <Box />;
}
