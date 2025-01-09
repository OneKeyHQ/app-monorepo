import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgZip = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M18 4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2m4 0h4m-4 4h4m-4 4h4v2a2 2 0 1 1-4 0v-2Z"
    />
  </Svg>
);
export default SvgZip;
