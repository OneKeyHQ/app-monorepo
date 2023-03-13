import type { FC } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { useNavigation, useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Box,
  Button,
  Center,
  Modal,
  Progress,
  Text,
} from '@onekeyhq/components';
import { TextareaWithLineNumber } from '@onekeyhq/kit/src/views/BulkSender/TextareaWithLineNumber';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import type {
  CreateAccountModalRoutes,
  CreateAccountRoutesParams,
} from '../../../routes';
import type { ModalScreenProps } from '../../../routes/types';
import type { RouteProp } from '@react-navigation/native';

type NavigationProps = ModalScreenProps<CreateAccountRoutesParams>;
type RouteProps = RouteProp<
  CreateAccountRoutesParams,
  CreateAccountModalRoutes.ExportAddresses
>;

const ExportAddresses: FC = () => {
  const intl = useIntl();
  const route = useRoute<RouteProps>();
  const { data } = route.params;

  const addressText = useMemo(() => {
    let s = '';
    let i = 0;
    for (const item of data) {
      if (data.length > 1) {
        if (i > 0) {
          s += '\n';
        }
        s += `// ${item.name}\n`;
      }
      // eslint-disable-next-line no-loop-func, @typescript-eslint/no-loop-func
      item.data.forEach((account) => {
        s += `${account.address}\n`;
      });
      i += 1;
    }
    return s;
  }, [data]);

  return (
    <Modal
      header={intl.formatMessage({ id: 'action__export_addresses' })}
      hideSecondaryAction
    >
      <TextareaWithLineNumber
        readonly
        containerStyle={{ height: '100%' }}
        height="100%"
        receiverString={addressText}
        setReceiverString={() => {}}
      />
    </Modal>
  );
};

export default ExportAddresses;
