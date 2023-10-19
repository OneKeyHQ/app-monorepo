import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgGamepad = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 10v2m0 0v2m0-2h2m-2 0H6m0-6h12a4 4 0 0 1 4 4v4a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4v-4a4 4 0 0 1 4-4Z"
    />
    <Path
      fill="currentColor"
      stroke="currentColor"
      strokeLinecap="square"
      strokeWidth={0.75}
      d="M13.875 13.5a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Zm3-3a.875.875 0 1 0 1.75 0 .875.875 0 0 0-1.75 0Z"
    />
  </Svg>
);
export default SvgGamepad;
