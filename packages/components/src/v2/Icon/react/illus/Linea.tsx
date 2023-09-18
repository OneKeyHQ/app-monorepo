import Svg, { Path } from 'react-native-svg';

import type { SvgProps } from 'react-native-svg';

const SvgLinea = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 16 16" accessibilityRole="image" {...props}>
    <Path
      fill="#8C8CA1"
      d="M11.323 12.544H3.6V4.19h1.767v6.736h5.956v1.619ZM11.323 5.807c.87 0 1.577-.724 1.577-1.618 0-.894-.706-1.619-1.577-1.619-.87 0-1.576.725-1.576 1.619s.706 1.618 1.576 1.618Z"
    />
  </Svg>
);
export default SvgLinea;
