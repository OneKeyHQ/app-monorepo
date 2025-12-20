import Svg, {
  G,
  Path,
  Defs,
  LinearGradient,
  Stop,
  ClipPath,
} from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgSolCircle = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 32 32" accessibilityRole="image" {...props}>
    <G clipPath="url(#clip0_15_316)">
      <Path
        fill="url(#paint0_linear_15_316)"
        d="M7.85 21.177a.78.78 0 0 1 .548-.226h18.915c.346 0 .519.417.274.661l-3.736 3.737a.78.78 0 0 1-.548.226H4.388a.387.387 0 0 1-.275-.661z"
      />
      <Path
        fill="url(#paint1_linear_15_316)"
        d="M7.85 7.226A.8.8 0 0 1 8.398 7h18.915c.346 0 .518.417.274.661l-3.736 3.737a.78.78 0 0 1-.549.226H4.387a.387.387 0 0 1-.274-.661z"
      />
      <Path
        fill="url(#paint2_linear_15_316)"
        d="M23.85 14.157a.78.78 0 0 0-.547-.226H4.388a.387.387 0 0 0-.275.661L7.85 18.33c.143.143.34.226.548.226h18.915a.387.387 0 0 0 .274-.661z"
      />
    </G>
    <Defs>
      <LinearGradient
        id="paint0_linear_15_316"
        x1={25.506}
        x2={12.416}
        y1={4.768}
        y2={29.842}
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#00FFA3" />
        <Stop offset={1} stopColor="#DC1FFF" />
      </LinearGradient>
      <LinearGradient
        id="paint1_linear_15_316"
        x1={19.782}
        x2={6.691}
        y1={1.78}
        y2={26.854}
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#00FFA3" />
        <Stop offset={1} stopColor="#DC1FFF" />
      </LinearGradient>
      <LinearGradient
        id="paint2_linear_15_316"
        x1={22.626}
        x2={9.535}
        y1={3.264}
        y2={28.338}
        gradientUnits="userSpaceOnUse"
      >
        <Stop stopColor="#00FFA3" />
        <Stop offset={1} stopColor="#DC1FFF" />
      </LinearGradient>
      <ClipPath id="clip0_15_316">
        <Path fill="#fff" d="M4 7h23.7v18.575H4z" />
      </ClipPath>
    </Defs>
  </Svg>
);
export default SvgSolCircle;
