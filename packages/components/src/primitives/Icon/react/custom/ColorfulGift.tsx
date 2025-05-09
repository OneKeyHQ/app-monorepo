import Svg, {
  SvgProps,
  Path,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
const SvgColorfulGift = (props: SvgProps) => (
  <Svg viewBox="0 0 18 20" fill="none" accessibilityRole="image" {...props}>
    <Path
      d="M3 3.007A2.667 2.667 0 0 1 5.667.34C7.007.34 8.205.948 9 1.904A4.324 4.324 0 0 1 12.333.34 2.667 2.667 0 0 1 15 3.007c0 .859-.25 1.66-.681 2.333H16a2 2 0 1 1 0 4h-6v-4h.667A2.333 2.333 0 0 0 13 3.007a.667.667 0 0 0-.667-.667A2.333 2.333 0 0 0 10 4.673v.667H8v-.667A2.333 2.333 0 0 0 5.667 2.34.667.667 0 0 0 5 3.007 2.333 2.333 0 0 0 7.333 5.34H8v4H2a2 2 0 1 1 0-4h1.681A4.313 4.313 0 0 1 3 3.007Z"
      fill="url(#a)"
      fillOpacity={0.875}
    />
    <Path
      d="M10 11.34h7v5a3 3 0 0 1-3 3h-4v-8Z"
      fill="url(#b)"
      fillOpacity={0.875}
    />
    <Path
      d="M8 11.34H1v5a3 3 0 0 0 3 3h4v-8Z"
      fill="url(#c)"
      fillOpacity={0.875}
    />
    <Defs>
      <LinearGradient
        id="a"
        x1={0}
        y1={0.34}
        x2={18}
        y2={19.34}
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#0091FF" />
        <Stop offset={0.297} stopColor="#307AEC" />
        <Stop offset={1} stopColor="#8E4EC6" />
      </LinearGradient>
      <LinearGradient
        id="b"
        x1={0}
        y1={0.34}
        x2={18}
        y2={19.34}
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#0091FF" />
        <Stop offset={0.297} stopColor="#307AEC" />
        <Stop offset={1} stopColor="#8E4EC6" />
      </LinearGradient>
      <LinearGradient
        id="c"
        x1={0}
        y1={0.34}
        x2={18}
        y2={19.34}
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#0091FF" />
        <Stop offset={0.297} stopColor="#307AEC" />
        <Stop offset={1} stopColor="#8E4EC6" />
      </LinearGradient>
    </Defs>
  </Svg>
);
export default SvgColorfulGift;
