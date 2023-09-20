import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAdjustmentsHorizontal = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M10 3.75a2 2 0 1 0-4 0 2 2 0 0 0 4 0zm7.25.75a.75.75 0 0 0 0-1.5h-5.5a.75.75 0 0 0 0 1.5h5.5zM5 3.75a.75.75 0 0 1-.75.75h-1.5a.75.75 0 0 1 0-1.5h1.5a.75.75 0 0 1 .75.75zM4.25 17a.75.75 0 0 0 0-1.5h-1.5a.75.75 0 0 0 0 1.5h1.5zm13 0a.75.75 0 0 0 0-1.5h-5.5a.75.75 0 0 0 0 1.5h5.5zM9 10a.75.75 0 0 1-.75.75h-5.5a.75.75 0 0 1 0-1.5h5.5A.75.75 0 0 1 9 10zm8.25.75a.75.75 0 0 0 0-1.5h-1.5a.75.75 0 0 0 0 1.5h1.5zM14 10a2 2 0 1 0-4 0 2 2 0 0 0 4 0zm-4 6.25a2 2 0 1 0-4 0 2 2 0 0 0 4 0z" />
  </Svg>
);
export default SvgAdjustmentsHorizontal;
