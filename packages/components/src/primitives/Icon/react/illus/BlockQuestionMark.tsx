import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBlockQuestionMark = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 180 180" accessibilityRole="image" {...props}>
    <Path
      stroke="#000"
      strokeLinejoin="round"
      d="M57 33h90l-24 24H33zM57 123h90l-24 24H33z"
    />
    <Path stroke="#000" strokeLinejoin="round" d="M57 33h90v90H57z" />
    <Path
      stroke="#000"
      d="M82.261 103.962v-5.173a8.33 8.33 0 0 1 8.53-8.326C99.68 90.678 107 83.532 107 74.642v-1.635a4.585 4.585 0 0 0-4.585-4.585H88.3a10 10 0 0 0-7.071 2.929l-4.571 4.571M78.352 110.532h8.541"
    />
    <Path stroke="#000" strokeLinejoin="round" d="M33 57h90v90H33z" />
    <Path fill="#000" d="M123 147v-24h24z" />
    <Path
      fill="#4FE737"
      stroke="#000"
      strokeLinejoin="round"
      d="M57 33v24H33z"
    />
  </Svg>
);
export default SvgBlockQuestionMark;
