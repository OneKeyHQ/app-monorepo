import * as React from 'react';
import Svg, { SvgProps, Rect, Path } from 'react-native-svg';

function SvgTxTypeSendCircle(props: SvgProps) {
  return (
    <Svg width={32} height={32} fill="none" {...props}>
      <Rect width={32} height={32} rx={16} fill="#3D3D4D" />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M9.293 15.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L17 11.414V23a1 1 0 11-2 0V11.414l-4.293 4.293a1 1 0 01-1.414 0z"
        fill="#8C8CA1"
      />
    </Svg>
  );
}

export default SvgTxTypeSendCircle;
