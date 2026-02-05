import Svg, { G, Path, Defs, ClipPath } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEthCircle = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 32 32" accessibilityRole="image" {...props}>
    <G clipPath="url(#clip0_15_298)">
      <Path
        fill="#627EEA"
        d="M16 32c8.837 0 16-7.163 16-16S24.837 0 16 0 0 7.163 0 16s7.163 16 16 16"
      />
      <Path fill="#fff" fillOpacity={0.602} d="M16.498 4v8.87l7.497 3.35z" />
      <Path fill="#fff" d="M16.498 4 9 16.22l7.498-3.35z" />
      <Path
        fill="#fff"
        fillOpacity={0.602}
        d="M16.498 21.968v6.027L24 17.616z"
      />
      <Path fill="#fff" d="M16.498 27.995v-6.028L9 17.616z" />
      <Path
        fill="#fff"
        fillOpacity={0.2}
        d="m16.498 20.573 7.497-4.353-7.497-3.348z"
      />
      <Path fill="#fff" fillOpacity={0.602} d="m9 16.22 7.498 4.353v-7.701z" />
    </G>
    <Defs>
      <ClipPath id="clip0_15_298">
        <Path fill="#fff" d="M0 0h32v32H0z" />
      </ClipPath>
    </Defs>
  </Svg>
);
export default SvgEthCircle;
