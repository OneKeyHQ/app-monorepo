import {
  TxListActionBox,
  TxListActionBoxExtraText,
} from '../components/TxListActionBox';

import type { ITxActionMetaIcon, ITxActionMetaTitle } from '../types';

type Props = {
  iconInfo: ITxActionMetaIcon;
  titleInfo: ITxActionMetaTitle;
};

function TxMoreInfo(props: Props) {
  const { iconInfo, titleInfo } = props;
  return <TxListActionBox iconInfo={iconInfo} titleInfo={titleInfo} />;
}

function TxMoreInfoT0(props: Props) {
  const { iconInfo, titleInfo } = props;
  return <TxListActionBox iconInfo={iconInfo} titleInfo={titleInfo} />;
}

export { TxMoreInfo, TxMoreInfoT0 };
