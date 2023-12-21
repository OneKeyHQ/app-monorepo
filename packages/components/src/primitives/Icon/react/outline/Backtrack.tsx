import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBacktrack = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m15 10-2 2m0 0-2 2m2-2-2-2m2 2 2 2M7.16 5H19a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7.16a2 2 0 0 1-1.736-1.008l-2.857-5a2 2 0 0 1 0-1.984l2.857-5A2 2 0 0 1 7.161 5Z"
    />
  </Svg>
);
export default SvgBacktrack;
