import Svg, { G, Path, Defs, ClipPath, Rect } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMonero = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 16 16" accessibilityRole="image" {...props}>
    <G clipPath="url(#clip0_716_165)">
      <G fill="#8C8CA1" clipPath="url(#clip1_716_165)">
        <Path d="M.407 10.525h2.394V3.796l5.2 5.199L13.2 3.796v6.73h2.393a8 8 0 0 1-.757 1.63h-3.371V7.92L8 11.385 4.536 7.921v4.234H1.163a8.023 8.023 0 0 1-.756-1.63M3.192 1.605A7.97 7.97 0 0 1 8 0V0C6.196 0 4.53.597 3.192 1.605M15.989 7.576a7.947 7.947 0 0 1 0 0" />
      </G>
    </G>
    <Defs>
      <ClipPath id="clip0_716_165">
        <Rect width={16} height={16} fill="#fff" rx={8} />
      </ClipPath>
      <ClipPath id="clip1_716_165">
        <Path fill="#fff" d="M16 0H0v16h16z" />
      </ClipPath>
    </Defs>
  </Svg>
);
export default SvgMonero;
