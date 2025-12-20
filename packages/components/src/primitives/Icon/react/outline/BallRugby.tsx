import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBallRugby = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="m10.25 13.75 3.5-3.5m-.607-7.107A12 12 0 0 1 15 3h5a1 1 0 0 1 1 1v5q-.001.949-.143 1.857m-7.714-7.714 7.714 7.714m-7.714-7.714a12.01 12.01 0 0 0-10 10m17.714-2.286a12.01 12.01 0 0 1-10 10m0 0Q9.949 20.999 9 21H4a1 1 0 0 1-1-1v-5q.001-.949.143-1.857m7.714 7.714-7.714-7.714"
    />
  </Svg>
);
export default SvgBallRugby;
