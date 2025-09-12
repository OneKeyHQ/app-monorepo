import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgOnekeyPrimeDark = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="#fff"
      fillRule="evenodd"
      d="M1 12h4v9h7V3H4z"
      clipRule="evenodd"
    />
    <Path
      fill="url(#paint0_linear_9617_88)"
      d="M22 11a8 8 0 0 0-8-8v16a8 8 0 0 0 8-8"
    />
    <Defs>
      <LinearGradient
        id="paint0_linear_9617_88"
        x1={18}
        x2={18}
        y1={3}
        y2={19}
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#42FF00" />
        <Stop offset={1} stopColor="#00FFD1" />
      </LinearGradient>
    </Defs>
  </Svg>
);
export default SvgOnekeyPrimeDark;
