import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBuildingLibrary = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M9.674 2.075a.75.75 0 0 1 .652 0l7.25 3.5A.75.75 0 0 1 17 6.957V16.5h.25a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1 0-1.5H3V6.957a.75.75 0 0 1-.576-1.382l7.25-3.5zM11 6a1 1 0 1 1-2 0 1 1 0 0 1 2 0zM7.5 9.75a.75.75 0 0 0-1.5 0v5.5a.75.75 0 0 0 1.5 0v-5.5zm3.25 0a.75.75 0 0 0-1.5 0v5.5a.75.75 0 0 0 1.5 0v-5.5zm3.25 0a.75.75 0 0 0-1.5 0v5.5a.75.75 0 0 0 1.5 0v-5.5z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgBuildingLibrary;
