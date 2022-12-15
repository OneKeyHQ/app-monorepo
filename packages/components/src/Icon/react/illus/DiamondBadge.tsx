import Svg, {
  SvgProps,
  Circle,
  Path,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
const SvgDiamondBadge = (props: SvgProps) => (
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
      d="m4.365 8.556 1.298-2.084A1 1 0 0 1 6.512 6h6.976a1 1 0 0 1 .849.472l1.298 2.084a1 1 0 0 1-.054 1.136l-3.992 5.226a2 2 0 0 1-3.179 0L4.42 9.692a1 1 0 0 1-.055-1.136Z"
      fill="#E3E7ED"
    />
    <Path
      d="m4.577 8.689 1.298-2.085a.75.75 0 0 1 .637-.354h6.976c.26 0 .5.134.637.354l1.298 2.085a.75.75 0 0 1-.04.851l-3.992 5.227a1.75 1.75 0 0 1-2.782 0L4.618 9.54a.75.75 0 0 1-.04-.851Z"
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
        <Stop stopColor="#A2ACB6" />
        <Stop offset={1} stopColor="#CCD4DB" />
      </LinearGradient>
      <LinearGradient
        id="b"
        x1={10}
        y1={0}
        x2={10}
        y2={20}
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#CCD4DB" />
        <Stop offset={1} stopColor="#A2ACB6" />
      </LinearGradient>
      <LinearGradient
        id="c"
        x1={10}
        y1={6}
        x2={10}
        y2={17}
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#fff" />
        <Stop offset={1} stopColor="#fff" stopOpacity={0} />
      </LinearGradient>
    </Defs>
  </Svg>
);
export default SvgDiamondBadge;
