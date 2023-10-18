import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgChecklistBox = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m7.543 9.498 1.125.75 1.872-2.496M14.058 9h2M14 15h2m-8.457.499 1.125.75 1.872-2.496M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z"
    />
  </Svg>
);
export default SvgChecklistBox;
