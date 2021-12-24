import * as React from 'react';
import Svg, { SvgProps, Rect, Path } from 'react-native-svg';

function SvgTxTypeApproveCircle(props: SvgProps) {
  return (
    <Svg width={32} height={32} fill="none" {...props}>
      <Rect width={32} height={32} rx={16} fill="#3D3D4D" />
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12.267 9.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L15 16.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        fill="#8C8CA1"
      />
    </Svg>
  );
}

export default SvgTxTypeApproveCircle;
