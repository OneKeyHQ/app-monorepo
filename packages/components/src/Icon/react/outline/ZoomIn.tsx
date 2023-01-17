import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgZoomIn = (props: SvgProps) => (
  <Svg
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="m21 21-6-6m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0zm-7-3v3m0 0v3m0-3h3m-3 0H7"
    />
  </Svg>
);
export default SvgZoomIn;
