import Svg, { Path, Circle } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBlockCoins = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 180 180" accessibilityRole="image" {...props}>
    <Path
      stroke="#000"
      strokeLinejoin="round"
      d="M52 38h90l-14 14H38zM52 128h90l-14 14H38z"
    />
    <Path stroke="#000" strokeLinejoin="round" d="M52 38h90v90H52z" />
    <Path stroke="#000" strokeLinejoin="round" d="M38 52h90v90H38z" />
    <Path
      fill="#000"
      d="M128 142v-14h14zM91.037 61.473c14.981 0 27.124 12.144 27.124 27.125 0 8.273-3.705 15.679-9.545 20.654-4.97 5.622-12.233 9.169-20.327 9.169-14.98 0-27.125-12.144-27.125-27.124 0-8.272 3.704-15.678 9.542-20.653 4.97-5.624 12.236-9.171 20.331-9.171m-4.074 55.92q.324.017.651.026l.675.008q-.668 0-1.326-.034"
    />
    <Path
      fill="#4FE737"
      d="M116.421 82.364c.399 1.63.646 3.321.723 5.056l-8.551 3.263-1.776-4.656zm-5.766-11.03a26.1 26.1 0 0 1 5.025 8.546l-7.798 2.975-3.484-9.133z"
    />
    <Circle
      cx={88.287}
      cy={91.296}
      r={26.628}
      fill="#fff"
      stroke="#000"
      strokeWidth={0.994}
    />
    <Circle
      cx={88.293}
      cy={91.296}
      r={20.132}
      fill="#fff"
      stroke="#000"
      strokeWidth={0.994}
    />
    <Path
      stroke="#000"
      strokeWidth={0.994}
      d="M81.42 99.273h13.478a4.126 4.126 0 0 0 0-8.251H81.42"
    />
    <Path
      stroke="#000"
      strokeWidth={0.994}
      d="M95.174 82.769H81.696a4.126 4.126 0 1 0 0 8.251h13.478"
    />
    <Path
      stroke="#000"
      strokeLinejoin="bevel"
      strokeWidth={0.994}
      d="M88.32 79.469v3.107M88.32 99.063v3.107"
    />
    <Path
      fill="#4FE737"
      stroke="#000"
      strokeLinejoin="round"
      d="M52 38v14H38z"
    />
  </Svg>
);
export default SvgBlockCoins;
