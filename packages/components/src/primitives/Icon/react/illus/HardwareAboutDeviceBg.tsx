import Svg, {
  SvgProps,
  Path,
  Defs,
  RadialGradient,
  Stop,
} from 'react-native-svg';
const SvgHardwareAboutDeviceBg = (props: SvgProps) => (
  <Svg viewBox="0 0 330 330" fill="none" accessibilityRole="image" {...props}>
    <Path fill="url(#a)" d="M0 0h330v330H0z" />
    <Defs>
      <RadialGradient
        id="a"
        cx={0}
        cy={0}
        r={1}
        gradientUnits="userSpaceOnUse"
        gradientTransform="rotate(90 0 165) scale(165)"
      >
        <Stop stopColor="#5CC34C" />
        <Stop offset={1} stopColor="#5CC34C" stopOpacity={0} />
      </RadialGradient>
    </Defs>
  </Svg>
);
export default SvgHardwareAboutDeviceBg;
