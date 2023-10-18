import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFaceSmiley = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M11 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm5 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
    />
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2}
      d="M6.59 13a5.502 5.502 0 0 0 10.82 0M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
    />
  </Svg>
);
export default SvgFaceSmiley;
