import Svg, { G, Path, Defs, ClipPath } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBrokenLink2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <G clipPath="url(#a)">
      <Path
        fillRule="evenodd"
        d="m4.787 1.272 1.94-.485.986 3.94-1.94.485zm13.748 4.193a5.003 5.003 0 0 0-7.076 0l-.005.005L9.99 6.914 8.586 5.49l1.46-1.441a7.003 7.003 0 0 1 9.905 9.904l-.002.002-1.44 1.459-1.423-1.405 1.449-1.468a5.003 5.003 0 0 0 0-7.076M1.271 4.787l3.94.985-.484 1.94-3.94-.985zM6.914 9.99l-1.448 1.468a5.003 5.003 0 1 0 7.075 7.076l.005-.004 1.463-1.444 1.405 1.423-1.458 1.44-.003.002a7.003 7.003 0 0 1-9.904-9.905l1.442-1.46zm12.358 6.297 3.94.985-.484 1.94-3.94-.985zm-2.985 2.985 1.94-.485.986 3.94-1.94.485z"
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
export default SvgBrokenLink2;
