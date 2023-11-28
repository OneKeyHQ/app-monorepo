import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgSliderHor = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M14 7H4m10 0a3 3 0 1 1 6 0 3 3 0 1 1-6 0Zm6 10h-8m0 0a3 3 0 1 1-6 0m6 0a3 3 0 1 0-6 0m0 0H4"
    />
  </Svg>
);
export default SvgSliderHor;
