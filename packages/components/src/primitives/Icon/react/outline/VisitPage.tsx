import Svg, { G, Path, Defs, ClipPath } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVisitPage = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <G clipPath="url(#a)">
      <Path
        fillRule="evenodd"
        d="m24.18 16.778-4.935 2.467-2.467 4.935-3.29-10.692zm-6.958 2.041.533-1.064 1.064-.533-2.308-.711z"
        clipRule="evenodd"
      />
      <Path d="M22 12h-2V6H4v13h8v2H2V4h20z" />
      <Path d="M6.75 7.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5m3.5 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5m3.5 0a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5" />
    </G>
    <Defs>
      <ClipPath id="a">
        <Path d="M0 0h24v24H0z" />
      </ClipPath>
    </Defs>
  </Svg>
);
export default SvgVisitPage;
