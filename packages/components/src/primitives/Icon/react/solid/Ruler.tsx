import Svg, { G, Path, Defs, ClipPath } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgRuler = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <G clipPath="url(#a)">
      <Path d="m11.5 3.086 3.5-3.5L22.414 7 7 22.414-.414 15l3.5-3.5 2.664 2.664 1.414-1.414L4.5 10.086 6.586 8l3.664 3.664 1.414-1.414L8 6.586 10.086 4.5l2.664 2.664 1.414-1.414z" />
    </G>
    <Defs>
      <ClipPath id="a">
        <Path d="M0 0h24v24H0z" />
      </ClipPath>
    </Defs>
  </Svg>
);
export default SvgRuler;
