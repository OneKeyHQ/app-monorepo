import Svg, { Path, Defs, RadialGradient, Stop } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgHardwareAboutDeviceBg = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 330 330" accessibilityRole="image" {...props}>
    <Path fill="url(#a)" d="M0 0h330v330H0z" />
    <Defs>
      <RadialGradient
        id="a"
        cx={0}
        cy={0}
        r={1}
        gradientTransform="rotate(90 0 165) scale(165)"
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#5CC34C" />
        <Stop offset={1} stopColor="#5CC34C" stopOpacity={0} />
      </RadialGradient>
    </Defs>
  </Svg>
);
export default SvgHardwareAboutDeviceBg;
