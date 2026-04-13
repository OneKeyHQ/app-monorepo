import { useCallback, useEffect, useState } from 'react';

import { getStringAsync, setStringAsync } from 'expo-clipboard';
import { useIntl } from 'react-intl';

import { Checkbox, Page, SizableText, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EDAppModalPageStatus } from '@onekeyhq/shared/types/dappConnection';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useDappApproveAction from '../../../hooks/useDappApproveAction';
import useDappQuery from '../../../hooks/useDappQuery';
import {
  DAppRequestFooter,
  DAppRequestLayout,
} from '../components/DAppRequestLayout';
import { useRiskDetection } from '../hooks/useRiskDetection';

import DappOpenModalPage from './DappOpenModalPage';

function ClipboardPermissionModal() {
  const { $sourceInfo, clipboardType, textNonce } = useDappQuery<{
    clipboardType: 'read' | 'write';
    textNonce?: string;
  }>();

  // Retrieve sensitive text from background memory store (not from route
  // params) to avoid clipboard content appearing in logs
  const [textToWrite, setTextToWrite] = useState<string | undefined>();
  const [textLoading, setTextLoading] = useState(!!textNonce);
  useEffect(() => {
    if (textNonce) {
      void backgroundApiProxy.serviceDApp
        .getClipboardTextToWrite(textNonce)
        .then((text) => {
          setTextToWrite(text);
          setTextLoading(false);
        })
        .catch(() => {
          setTextLoading(false);
        });
    }
  }, [textNonce]);

  const dappApprove = useDappApproveAction({
    id: $sourceInfo?.id ?? '',
    closeWindowAfterResolved: true,
  });

  const {
    showContinueOperate,
    continueOperate,
    setContinueOperate,
    riskLevel,
    urlSecurityInfo,
  } = useRiskDetection({ origin: $sourceInfo?.origin ?? '' });

  const intl = useIntl();
  const [remember, setRemember] = useState(false);

  const isRead = clipboardType === 'read';

  const title = intl.formatMessage({
    id: isRead
      ? ETranslations.clipboard_read__title
      : ETranslations.clipboard_write__title,
  });

  const subtitle = intl.formatMessage({
    id: isRead
      ? ETranslations.clipboard_read__desc
      : ETranslations.clipboard_write__desc,
  });

  const onConfirm = useCallback(
    async (close?: (extra?: { flag?: string }) => void) => {
      let content: string | undefined;

      // Perform clipboard operations in the UI process where
      // expo-clipboard APIs are available
      if (isRead) {
        content = await getStringAsync();
      } else if (textToWrite !== undefined) {
        await setStringAsync(textToWrite);
      }

      void dappApprove.resolve({
        result: { allowed: true, remember, content },
        close: () => {
          close?.({ flag: EDAppModalPageStatus.Confirmed });
        },
      });
    },
    [dappApprove, remember, isRead, textToWrite],
  );

  return (
    <DappOpenModalPage dappApprove={dappApprove}>
      <>
        <Page.Header headerShown={false} />
        <Page.Body>
          <DAppRequestLayout
            title={title}
            subtitle={subtitle}
            origin={$sourceInfo?.origin ?? ''}
            urlSecurityInfo={urlSecurityInfo}
          >
            {!isRead && textToWrite ? (
              <Stack
                px="$5"
                py="$3"
                mx="$5"
                borderRadius="$2"
                backgroundColor="$bgSubdued"
              >
                <SizableText
                  size="$bodySm"
                  color="$textSubdued"
                  numberOfLines={3}
                >
                  {textToWrite}
                </SizableText>
              </Stack>
            ) : null}
          </DAppRequestLayout>
        </Page.Body>
        <Page.Footer>
          <Stack px="$5" pb="$2">
            <Checkbox
              label={intl.formatMessage({
                id: ETranslations.clipboard_remember__action,
              })}
              value={remember}
              onChange={(checked) => setRemember(!!checked)}
            />
          </Stack>
          <DAppRequestFooter
            continueOperate={continueOperate}
            setContinueOperate={(checked) => {
              setContinueOperate(!!checked);
            }}
            onConfirm={onConfirm}
            onCancel={() => dappApprove.reject()}
            confirmButtonProps={{
              disabled:
                textLoading ||
                (!isRead && textToWrite === undefined) ||
                (showContinueOperate ? !continueOperate : false),
            }}
            showContinueOperateCheckbox={showContinueOperate}
            riskLevel={riskLevel}
            confirmText={intl.formatMessage({
              id: ETranslations.global_allow,
            })}
          />
        </Page.Footer>
      </>
    </DappOpenModalPage>
  );
}

export default ClipboardPermissionModal;
