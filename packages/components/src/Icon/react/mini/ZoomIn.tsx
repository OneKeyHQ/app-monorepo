import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgZoomIn = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M5 8a1 1 0 0 1 1-1h1V6a1 1 0 0 1 2 0v1h1a1 1 0 1 1 0 2H9v1a1 1 0 1 1-2 0V9H6a1 1 0 0 1-1-1z" />
    <Path
      fillRule="evenodd"
      d="M2 8a6 6 0 1 1 10.89 3.476l4.817 4.817a1 1 0 0 1-1.414 1.414l-4.816-4.816A6 6 0 0 1 2 8zm6-4a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgZoomIn;
