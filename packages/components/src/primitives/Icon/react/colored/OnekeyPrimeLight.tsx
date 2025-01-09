import Svg, {
  SvgProps,
  Path,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
const SvgOnekeyPrimeLight = (props: SvgProps) => (
  <Svg viewBox="0 0 24 24" fill="none" accessibilityRole="image" {...props}>
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M1 12h4v9h7V3H4l-3 9Z"
      fill="#000"
    />
    <Path d="M22 11a8 8 0 0 0-8-8v16a8 8 0 0 0 8-8Z" fill="url(#a)" />
    <Defs>
      <LinearGradient
        id="a"
        x1={18}
        y1={3}
        x2={18}
        y2={19}
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#3ADE00" />
        <Stop offset={1} stopColor="#00E19D" />
      </LinearGradient>
    </Defs>
  </Svg>
);
export default SvgOnekeyPrimeLight;
