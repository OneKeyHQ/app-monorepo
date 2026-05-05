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
      <Path
        fillRule="evenodd"
        d="M22.414 7 7 22.414-.414 15 15-.414zm-9.5-2.5 1.25 1.25-1.414 1.414-1.25-1.25L9.414 8l2.25 2.25-1.414 1.414L8 9.414 5.914 11.5l1.25 1.25-1.414 1.414-1.25-1.25L2.414 15 7 19.586 19.586 7 15 2.414z"
        clipRule="evenodd"
      />
    </G>
    <Defs>
      <ClipPath id="a">
        <Path d="M0 0h24v24H0z" />
      </ClipPath>
    </Defs>
  </Svg>
);
export default SvgRuler;
