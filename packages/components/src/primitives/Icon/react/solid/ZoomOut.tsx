import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgZoomOut = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M11 3a8 8 0 1 0 4.906 14.32l3.387 3.387a1 1 0 0 0 1.414-1.414l-3.387-3.387A8 8 0 0 0 11 3Zm4 8a1 1 0 0 1-1 1H8a1 1 0 1 1 0-2h6a1 1 0 0 1 1 1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgZoomOut;
