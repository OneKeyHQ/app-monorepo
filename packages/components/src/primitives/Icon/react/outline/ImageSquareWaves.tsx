import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgImageSquareWaves = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m4 14.21 2.845-2.128a2 2 0 0 1 2.575.303c1.492 1.608 3.223 3.069 5.58 3.069 2.173 0 3.613-.806 5-2.193M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2ZM17 9a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"
    />
  </Svg>
);
export default SvgImageSquareWaves;
