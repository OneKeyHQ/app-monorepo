import Svg, {
  SvgProps,
  Circle,
  Path,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
const SvgStarBadge = (props: SvgProps) => (
  <Svg viewBox="0 0 20 20" fill="none" accessibilityRole="image" {...props}>
    <Circle cx={10} cy={10} r={10} fill="url(#a)" />
    <Circle
      cx={10}
      cy={10}
      r={9.25}
      stroke="url(#b)"
      strokeOpacity={0.5}
      strokeWidth={1.5}
    />
    <Path
      d="M9.123 4.604a1 1 0 0 1 1.754 0l1.08 1.975a1 1 0 0 0 .693.503l2.211.417a1 1 0 0 1 .543 1.669l-1.544 1.637a1 1 0 0 0-.265.814l.287 2.232a1 1 0 0 1-1.42 1.032l-2.034-.963a1 1 0 0 0-.856 0l-2.034.963a1 1 0 0 1-1.42-1.032l.287-2.232a1 1 0 0 0-.265-.814L4.596 9.168a1 1 0 0 1 .542-1.67l2.212-.416a1 1 0 0 0 .692-.503l1.08-1.975Z"
      fill="#FFE5CF"
    />
    <Path
      d="M9.342 4.724a.75.75 0 0 1 1.316 0l1.08 1.975c.18.328.497.559.865.628l2.212.418a.75.75 0 0 1 .407 1.251l-1.544 1.638a1.25 1.25 0 0 0-.33 1.016l.286 2.233a.75.75 0 0 1-1.065.774l-2.035-.963a1.25 1.25 0 0 0-1.068 0l-2.035.963a.75.75 0 0 1-1.065-.774l.287-2.232a1.25 1.25 0 0 0-.33-1.017L4.777 8.996a.75.75 0 0 1 .407-1.251l2.212-.418c.368-.07.685-.3.865-.628l1.08-1.975Z"
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
        <Stop stopColor="#DD9148" />
        <Stop offset={1} stopColor="#F9D7B8" />
      </LinearGradient>
      <LinearGradient
        id="b"
        x1={10}
        y1={0}
        x2={10}
        y2={20}
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#F9D7B8" />
        <Stop offset={1} stopColor="#DD9148" />
      </LinearGradient>
      <LinearGradient
        id="c"
        x1={10}
        y1={3.001}
        x2={10}
        y2={17.001}
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#fff" />
        <Stop offset={1} stopColor="#fff" stopOpacity={0} />
      </LinearGradient>
    </Defs>
  </Svg>
);
export default SvgStarBadge;
