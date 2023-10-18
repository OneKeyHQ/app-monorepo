import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgLookGlasses = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M1 10h1.535M23 10h-1.535m-18.93 0a4 4 0 1 0 6.892-.063M2.536 10A3.998 3.998 0 0 1 6 8a4 4 0 0 1 3.428 1.937m0 0A3.984 3.984 0 0 1 12 9c.98 0 1.877.352 2.572.937m0 0a4 4 0 1 0 6.892.063m-6.891-.063A3.998 3.998 0 0 1 18 8c1.48 0 2.773.804 3.465 2"
    />
  </Svg>
);
export default SvgLookGlasses;
