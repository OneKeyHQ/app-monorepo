import type { FC } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Box,
  Modal,
  SegmentedControl,
  Text,
  Textarea,
  ToastManager,
} from '@onekeyhq/components';
import type { IInscriptionContent } from '@onekeyhq/engine/src/vaults/impl/btc/inscribe/types';
import type { InscribeModalRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/Inscribe';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { useActiveSideAccount } from '../../../hooks';
import { InscribeModalRoutes } from '../../../routes/routesEnum';
import HeaderDescription from '../Components/HeaderDescription';
import { InscribeUploader } from '../Components/InscribeUploader';
import Steps from '../Components/Steps';
import { OrderButton } from '../OrderList';

import FileDescription from './FileDescription';

import type { InscribeFile } from '../Components/InscribeUploader/type';
import type { RouteProp } from '@react-navigation/core';

type NavigationProps = ModalScreenProps<InscribeModalRoutesParams>;

type RouteProps = RouteProp<
  InscribeModalRoutesParams,
  InscribeModalRoutes.InscribeModal
>;

const CreateContent: FC = () => {
  const intl = useIntl();
  const [selectIndex, setSelectedIndex] = useState(0);
  const navigation = useNavigation<NavigationProps['navigation']>();
  const route = useRoute<RouteProps>();
  const { networkId, accountId } = route?.params || {};
  const [file, setFileFromOut] = useState<InscribeFile>();
  const [text, setText] = useState<string>('');
  const [error, setError] = useState('');
  const { serviceInscribe } = backgroundApiProxy;
  const { network, account } = useActiveSideAccount({ accountId, networkId });

  const onPromise = useCallback(async () => {
    let contents: IInscriptionContent[] = [];
    const routeParams: InscribeModalRoutesParams[InscribeModalRoutes.ReceiveAddress] =
      {
        networkId,
        accountId,
        contents,
        size: 0,
        address: account?.address,
      };
    if (selectIndex === 0) {
      if (file?.dataForAPI && file?.name) {
        try {
          contents = await serviceInscribe.createInscriptionContents({
            files: [
              {
                data: file?.dataForAPI,
                filename: file?.name,
                mimetype: file?.type,
              },
            ],
          });
          Object.assign(routeParams, { size: file.size, contents, file });
        } catch (e) {
          console.log('error = ', e);
        }
      }
    }

    if (selectIndex === 1) {
      const trimText = text.trim();
      if (trimText.length > 0) {
        try {
          contents = await serviceInscribe.createInscriptionContents({
            texts: [trimText],
          });
          Object.assign(routeParams, { size: trimText.length, contents });
        } catch (e: any) {
          const { key: errorKey = '', info } = e;
          if (errorKey === 'msg__file_size_should_less_than_str') {
            ToastManager.show(
              {
                title: intl.formatMessage({ id: errorKey }, info),
              },
              { type: 'error' },
            );
          }
        }
      }
    }
    if (contents?.length > 0) {
      navigation.navigate(InscribeModalRoutes.ReceiveAddress, routeParams);
    }
  }, [
    account?.address,
    accountId,
    file,
    intl,
    navigation,
    networkId,
    selectIndex,
    serviceInscribe,
    text,
  ]);

  const primaryDisable = useMemo(() => {
    if (selectIndex === 0 && file && error.length === 0) {
      return false;
    }
    if (selectIndex === 1 && text.trim().length > 0) {
      return false;
    }
    return true;
  }, [error.length, file, selectIndex, text]);
  return (
    <Modal
      header={intl.formatMessage({ id: 'title__inscribe' })}
      headerDescription={<HeaderDescription network={network} />}
      rightContent={<OrderButton />}
      height="640px"
      primaryActionTranslationId="action__next"
      hideSecondaryAction
      primaryActionProps={{
        onPromise,
        isDisabled: primaryDisable,
      }}
      staticChildrenProps={{
        flex: 1,
        padding: '16px',
      }}
    >
      <Steps numberOfSteps={3} currentStep={1} />
      <SegmentedControl
        style={{ marginTop: 16 }}
        selectedIndex={selectIndex}
        onChange={setSelectedIndex}
        values={[
          intl.formatMessage({ id: 'form__file' }),
          intl.formatMessage({ id: 'form__text' }),
        ]}
      />

      <Box mt="24px">
        {selectIndex === 0 ? (
          <InscribeUploader
            file={file}
            setFileFromOut={setFileFromOut}
            setError={setError}
          />
        ) : (
          <Textarea
            width="full"
            h="148px"
            value={text}
            onChangeText={setText}
            placeholder={intl.formatMessage({ id: 'form__type_here' })}
          />
        )}

        {selectIndex === 0 && (file?.dataForUI || error.length > 0) ? (
          <FileDescription file={file} error={error} />
        ) : null}
        {selectIndex === 0 && error.length > 0 ? (
          <Text mt="12px" typography="Caption" color="text-critical">
            {error}
          </Text>
        ) : null}
        <Text typography="Caption" color="text-subdued" mt="12px">
          {intl.formatMessage(
            {
              id: 'content__ordinal_support_jpg_webp_png_gif_txt_mp3_mp4_and_more',
            },
            { 0: '200KB' },
          )}
        </Text>
      </Box>
    </Modal>
  );
};

export default CreateContent;
