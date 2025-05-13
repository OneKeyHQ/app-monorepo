import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgColorfulGift = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="url(#paint0_linear_15163_53968)"
      fillOpacity={0.875}
      d="M6 4.667A2.667 2.667 0 0 1 8.667 2c1.34 0 2.538.608 3.333 1.564A4.32 4.32 0 0 1 15.333 2 2.667 2.667 0 0 1 18 4.667c0 .859-.25 1.66-.681 2.333H19a2 2 0 1 1 0 4h-6V7h.667A2.333 2.333 0 0 0 16 4.667.667.667 0 0 0 15.333 4 2.333 2.333 0 0 0 13 6.333V7h-2v-.667A2.333 2.333 0 0 0 8.667 4 .667.667 0 0 0 8 4.667 2.333 2.333 0 0 0 10.333 7H11v4H5a2 2 0 1 1 0-4h1.681A4.3 4.3 0 0 1 6 4.667"
    />
    <Path
      fill="url(#paint1_linear_15163_53968)"
      fillOpacity={0.875}
      d="M13 13h7v5a3 3 0 0 1-3 3h-4z"
    />
    <Path
      fill="url(#paint2_linear_15163_53968)"
      fillOpacity={0.875}
      d="M11 13H4v5a3 3 0 0 0 3 3h4z"
    />
    <Defs>
      <LinearGradient
        id="paint0_linear_15163_53968"
        x1={3}
        x2={21}
        y1={2}
        y2={21}
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#0091FF" />
        <Stop offset={0.297} stopColor="#307AEC" />
        <Stop offset={1} stopColor="#8E4EC6" />
      </LinearGradient>
      <LinearGradient
        id="paint1_linear_15163_53968"
        x1={3}
        x2={21}
        y1={2}
        y2={21}
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#0091FF" />
        <Stop offset={0.297} stopColor="#307AEC" />
        <Stop offset={1} stopColor="#8E4EC6" />
      </LinearGradient>
      <LinearGradient
        id="paint2_linear_15163_53968"
        x1={3}
        x2={21}
        y1={2}
        y2={21}
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
