import { QRCode } from '@onekeyhq/components';

import {
  RECEIVE_QR_MARK_PLATE_SIZE,
  RECEIVE_QR_MARK_SIZE,
} from './ReceiveShare/constants';

type IReceiveQRCodeProps = {
  value: string;
  size: number;
  // Fires once the code and its mark are drawn, see QRCode.onRenderReady.
  onRenderReady?: () => void;
};

// The receive QR code with the OneKey mark in its centre, as drawn by the
// receive page and by the native share card.
export function ReceiveQRCode({
  value,
  size,
  onRenderReady,
}: IReceiveQRCodeProps) {
  return (
    <QRCode
      value={value}
      size={size}
      brandMark
      logoSize={RECEIVE_QR_MARK_SIZE}
      logoMargin={(RECEIVE_QR_MARK_PLATE_SIZE - RECEIVE_QR_MARK_SIZE) / 2}
      onRenderReady={onRenderReady}
    />
  );
}
