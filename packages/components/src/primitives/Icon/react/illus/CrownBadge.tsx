import Svg, {
  SvgProps,
  Circle,
  Path,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
const SvgCrownBadge = (props: SvgProps) => (
  <Svg viewBox="0 0 20 20" fill="none" accessibilityRole="image" {...props}>
    <Circle
      cx={10}
      cy={10}
      r={9.25}
      fill="url(#a)"
      stroke="url(#b)"
      strokeWidth={1.5}
    />
    <Path
      d="M14.059 14H5.92a.47.47 0 0 1-.449-.321l-.81-2.48-.61-1.868a1 1 0 0 1 .41-1.155c.387-.255.888-.23 1.247.062l1.535 1.249L9.026 5.6c.17-.372.533-.601.95-.601h.01c.42.004.785.241.95.619l1.688 3.87 1.68-1.32c.36-.282.86-.3 1.242-.045a1 1 0 0 1 .404 1.15l-1.442 4.405a.47.47 0 0 1-.45.321Z"
      fill="#FBE3A2"
    />
    <Path
      d="M5.71 13.602h-.001l-.811-2.481-.61-1.868a.75.75 0 0 1 .31-.868.801.801 0 0 1 .953.047l1.534 1.249.25.204.135-.294 1.783-3.885a.778.778 0 0 1 .723-.456h.01a.781.781 0 0 1 .72.468l1.69 3.871.129.297.254-.2 1.68-1.32a.807.807 0 0 1 .948-.034.75.75 0 0 1 .305.864L14.27 13.6a.22.22 0 0 1-.211.149H5.92a.22.22 0 0 1-.21-.148Z"
      stroke="url(#c)"
      strokeOpacity={0.24}
      strokeWidth={0.5}
    />
    <Defs>
      <LinearGradient
        id="a"
        x1={10}
        y1={0}
        x2={10}
        y2={20}
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#FBA12C" />
        <Stop offset={1} stopColor="#FCD48B" />
      </LinearGradient>
      <LinearGradient
        id="b"
        x1={10}
        y1={0}
        x2={10}
        y2={20}
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#FCD48B" />
        <Stop offset={1} stopColor="#FBA12C" />
      </LinearGradient>
      <LinearGradient
        id="c"
        x1={10}
        y1={5}
        x2={10}
        y2={15.43}
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#fff" />
        <Stop offset={1} stopColor="#fff" stopOpacity={0} />
      </LinearGradient>
    </Defs>
  </Svg>
);
export default SvgCrownBadge;
