import Svg, { Path, Rect } from 'react-native-svg';

import type { SvgProps } from 'react-native-svg';

const SvgDialogIconTypeDanger = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 48 48" accessibilityRole="image" {...props}>
    <Rect width={48} height={48} x={0.5} fill="#6B1914" rx={24} />
    <Path
      stroke="#FF6259"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M24.5 21v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3l-6.928-12c-.77-1.333-2.694-1.333-3.464 0L15.84 28c-.77 1.333.192 3 1.732 3Z"
    />
  </Svg>
);
export default SvgDialogIconTypeDanger;
