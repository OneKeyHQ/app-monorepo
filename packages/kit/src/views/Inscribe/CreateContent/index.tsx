import type { FC } from 'react';
import { useCallback, useMemo, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Box,
  IconButton,
  Modal,
  SegmentedControl,
  Text,
  Textarea,
} from '@onekeyhq/components';
import type { IInscriptionContent } from '@onekeyhq/engine/src/vaults/impl/btc/inscribe/types';
import type { InscribeModalRoutesParams } from '@onekeyhq/kit/src/routes/Root/Modal/Inscribe';
import type { ModalScreenProps } from '@onekeyhq/kit/src/routes/types';
import { OnekeyNetwork } from '@onekeyhq/shared/src/config/networkIds';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { InscribeModalRoutes } from '../../../routes/routesEnum';
import { InscribeUploader } from '../Components/InscribeUploader';
import Steps from '../Components/Steps';

import CheckOrderMenu from './CheckOrderMenu';
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
  // const [showFileError, setShowFileError] = useState(false);
  const { serviceInscribe } = backgroundApiProxy;

  const rightContent = useMemo(
    () => (
      <CheckOrderMenu>
        <IconButton
          name="EllipsisVerticalOutline"
          type="plain"
          size="lg"
          circle
        />
      </CheckOrderMenu>
    ),
    [],
  );

  const onPromise = useCallback(async () => {
    let contents: IInscriptionContent[] = [];
    const routeParams: InscribeModalRoutesParams[InscribeModalRoutes.ReceiveAddress] =
      {
        networkId,
        accountId,
        contents,
        size: 0,
      };
    if (selectIndex === 0) {
      if (file) {
        contents = await serviceInscribe.createInscriptionContents({
          files: [
            { data: file?.data, filename: file?.name, mimetype: file?.type },
          ],
        });
        Object.assign(routeParams, { size: file.size, contents });
      }
    }

    if (selectIndex === 1) {
      const trimText = text.trim();
      if (trimText.length > 0) {
        contents = await serviceInscribe.createInscriptionContents({
          texts: [trimText],
        });
        Object.assign(routeParams, { size: trimText.length, contents });
      }
    }
    if (contents?.length > 0) {
      navigation.navigate(InscribeModalRoutes.ReceiveAddress, routeParams);
    }
  }, [
    accountId,
    file,
    navigation,
    networkId,
    selectIndex,
    serviceInscribe,
    text,
  ]);

  const primaryDisable = useMemo(() => {
    if (selectIndex === 0 && file) {
      return false;
    }
    if (selectIndex === 1 && text.trim().length > 0) {
      return false;
    }
    return true;
  }, [file, selectIndex, text]);
  return (
    <Modal
      header={intl.formatMessage({ id: 'title__inscribe' })}
      headerDescription={`Bitcoin${
        networkId === OnekeyNetwork.tbtc ? ' Testnet' : ''
      }`}
      rightContent={rightContent}
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
            // setShowFileError={setShowFileError}
          />
        ) : (
          <Textarea
            width="full"
            h="148px"
            value={text}
            onChangeText={setText}
          />
        )}

        {selectIndex === 0 && file?.data ? (
          <FileDescription file={file} />
        ) : null}
        <Text typography="Caption" color="text-subdued" mt="12px">
          {intl.formatMessage({
            id: 'content__ordinal_support_jpg_webp_png_gif_txt_mp3_mp4_and_more',
          })}
        </Text>
      </Box>
    </Modal>
  );
};

export default CreateContent;
