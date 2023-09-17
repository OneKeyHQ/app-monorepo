import Svg, { Path, Rect } from 'react-native-svg';

import type { SvgProps } from 'react-native-svg';

const SvgDialogIconTypeInfo = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 48 48" accessibilityRole="image" {...props}>
    <Rect width={48} height={48} x={0.5} fill="#3D3D4D" rx={24} />
    <Path
      stroke="#8C8CA1"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M25.5 28h-1v-4h-1m1-4h.01m8.99 4a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
    />
  </Svg>
);
export default SvgDialogIconTypeInfo;
