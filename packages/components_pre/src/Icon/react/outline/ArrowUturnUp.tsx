import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgArrowUturnUp = (props: SvgProps) => (
  <Svg
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m9 9 6-6m0 0 6 6m-6-6v12a6 6 0 0 1-12 0v-3"
    />
  </Svg>
);
export default SvgArrowUturnUp;
