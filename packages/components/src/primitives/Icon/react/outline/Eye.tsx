import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgEye = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
    />
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21.497 11.095c-4.837-8.127-14.157-8.127-18.994 0a1.771 1.771 0 0 0 0 1.81c4.837 8.127 14.157 8.127 18.994 0a1.77 1.77 0 0 0 0-1.81Z"
    />
  </Svg>
);
export default SvgEye;
