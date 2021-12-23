import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgTxTypeReceiveCircle(props: SvgProps) {
  return (
    <Svg width={32} height={32} fill="none" {...props}>
      <Path
        id="tx-type-receive-circle_svg__svg_1"
        d="M0 16C0 7.306 7.306 0 16 0c8.694 0 16 7.306 16 16 0 8.694-7.306 16-16 16-8.694 0-16-7.306-16-16z"
        opacity="undefined"
        fill="#3D3D4D"
      />
      <Path
        transform="rotate(-180 16 16)"
        id="tx-type-receive-circle_svg__svg_2"
        fill="#8C8CA1"
        d="M9.293 15.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L17 11.414V23a1 1 0 11-2 0V11.414l-4.293 4.293a1 1 0 01-1.414 0z"
        clipRule="evenodd"
        fillRule="evenodd"
      />
    </Svg>
  );
}

export default SvgTxTypeReceiveCircle;
