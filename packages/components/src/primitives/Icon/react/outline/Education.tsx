import Svg, { G, Path, Defs, ClipPath } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgEducation = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <G clipPath="url(#a)">
      <Path
        fillRule="evenodd"
        d="m24 9-.001 8h-2v-6.98L20 11.04v6.078l-8.001 4-7.999-4v-6.077L-.001 9l11.546-5.89.454-.233zm-12.001 6.123-.454-.232L6 12.06v3.82l5.999 3 6.001-3v-3.82zM4.399 9l7.6 3.877L19.599 9l-7.6-3.878z"
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
export default SvgEducation;
