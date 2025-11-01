import Svg, { G, Path, Defs, ClipPath } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTrxCircle = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 32 32" accessibilityRole="image" {...props}>
    <G clipPath="url(#clip0_15_259)">
      <Path
        fill="#EF0027"
        d="M16 32c8.837 0 16-7.163 16-16S24.837 0 16 0 0 7.163 0 16s7.163 16 16 16"
      />
      <Path
        fill="#fff"
        d="M21.932 9.913 7.5 7.257l7.595 19.112 10.583-12.894zm-.232 1.17 2.208 2.099-6.038 1.093zm-5.142 2.973-6.364-5.278 10.402 1.914zm-.453.934-1.038 8.58L9.472 9.487zm.96.455 6.687-1.21-7.67 9.343z"
      />
    </G>
    <Defs>
      <ClipPath id="clip0_15_259">
        <Path fill="#fff" d="M0 0h32v32H0z" />
      </ClipPath>
    </Defs>
  </Svg>
);
export default SvgTrxCircle;
