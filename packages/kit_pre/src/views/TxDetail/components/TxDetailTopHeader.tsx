import type { IDecodedTx } from '@onekeyhq/engine/src/vaults/types';

import { TxActionElementIconXLarge } from '../elements/TxActionElementIcon';
import { TxActionElementTitleHeading } from '../elements/TxActionElementTitle';
import { UNKNOWN_ACTION_ICON_NAME } from '../utils/getTxActionMeta';

import { TxListActionBox } from './TxListActionBox';
import { TxStatusBarInDetail } from './TxStatusBar';

export function TxDetailTopHeader(props: {
  decodedTx: IDecodedTx;
  showSubTitle: boolean;
}) {
  const { decodedTx, showSubTitle } = props;
  const title = (
    <TxActionElementTitleHeading
      titleInfo={{
        titleKey: 'transaction__contract_interaction',
      }}
    />
  );
  const icon = (
    <TxActionElementIconXLarge
      iconInfo={{
        icon: {
          name: UNKNOWN_ACTION_ICON_NAME,
        },
      }}
    />
  );

  return (
    <TxListActionBox
      icon={icon}
      title={title}
      subTitle={
        showSubTitle ? <TxStatusBarInDetail decodedTx={decodedTx} /> : undefined
      }
    />
  );
}
