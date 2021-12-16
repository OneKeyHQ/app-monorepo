import React, { FC } from 'react';

import SvgQRCode from 'react-native-qrcode-svg';

export type QRCodeProps = {
  size: number;
  value: string;
};

const QRCode: FC<QRCodeProps> = ({ size, value }) => (
  <SvgQRCode size={size} value={value} />
);

export default QRCode;
