import Svg, {
  SvgProps,
  Circle,
  Defs,
  RadialGradient,
  Stop,
} from 'react-native-svg';
const SvgHardwareAboutDeviceBg = (props: SvgProps) => (
  <Svg viewBox="0 0 330 160" fill="none" accessibilityRole="image" {...props}>
    <Circle opacity={0.2} cx={165} cy={160} r={165} fill="url(#a)" />
    <Defs>
      <RadialGradient
        id="a"
        cx={0}
        cy={0}
        r={1}
        gradientUnits="userSpaceOnUse"
        gradientTransform="matrix(0 165 -165 0 165 160)"
      >
        <Stop stopColor="#5CC34C" />
        <Stop offset={1} stopColor="#5CC34C" stopOpacity={0} />
      </RadialGradient>
    </Defs>
  </Svg>
);
export default SvgHardwareAboutDeviceBg;
