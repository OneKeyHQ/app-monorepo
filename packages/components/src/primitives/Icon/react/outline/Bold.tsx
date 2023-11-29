import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBold = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="square"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 12H6m7 0a4 4 0 0 0 0-8H8a2 2 0 0 0-2 2v6m7 0h1a4 4 0 0 1 0 8H8a2 2 0 0 1-2-2v-6"
    />
  </Svg>
);
export default SvgBold;
