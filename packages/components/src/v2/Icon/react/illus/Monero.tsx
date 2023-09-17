import Svg, { G, Path, Defs, ClipPath, Rect } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMonero = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 16 16" accessibilityRole="image" {...props}>
    <G clipPath="url(#a)">
      <G fill="#8C8CA1" clipPath="url(#b)">
        <Path d="M.407 10.525h2.394V3.796l5.2 5.199L13.2 3.796v6.73h2.393a7.956 7.956 0 0 1-.757 1.63h-3.371V7.92L8 11.385 4.536 7.921v4.234H1.163a8.023 8.023 0 0 1-.756-1.63ZM.291 10.146ZM3.192 1.605ZM3.192 1.605A7.973 7.973 0 0 1 8 0V0C6.196 0 4.53.597 3.192 1.605ZM15.989 7.576a7.947 7.947 0 0 1 0 0Z" />
      </G>
    </G>
    <Defs>
      <ClipPath id="a">
        <Rect width={16} height={16} fill="#fff" rx={8} />
      </ClipPath>
      <ClipPath id="b">
        <Path fill="#fff" d="M16 0H0v16h16z" />
      </ClipPath>
    </Defs>
  </Svg>
);
export default SvgMonero;
