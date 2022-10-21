import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPresentationChartBar = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M3 3a1 1 0 0 0 0 2v8a2 2 0 0 0 2 2h2.586l-1.293 1.293a1 1 0 1 0 1.414 1.414L10 15.414l2.293 2.293a1 1 0 0 0 1.414-1.414L12.414 15H15a2 2 0 0 0 2-2V5a1 1 0 1 0 0-2H3zm11 4a1 1 0 1 0-2 0v4a1 1 0 1 0 2 0V7zm-3 1a1 1 0 1 0-2 0v3a1 1 0 1 0 2 0V8zM8 9a1 1 0 0 0-2 0v2a1 1 0 1 0 2 0V9z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgPresentationChartBar;
