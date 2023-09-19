import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgCube = (props: SvgProps) => (
  <Svg
    viewBox="0 0 24 24"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12.378 1.602a.75.75 0 0 0-.756 0L3 6.632l9 5.25 9-5.25-8.622-5.03zM21.75 7.93l-9 5.25v9l8.628-5.032a.75.75 0 0 0 .372-.648V7.93zm-10.5 14.25v-9l-9-5.25v8.57a.75.75 0 0 0 .372.648l8.628 5.033z" />
  </Svg>
);
export default SvgCube;
