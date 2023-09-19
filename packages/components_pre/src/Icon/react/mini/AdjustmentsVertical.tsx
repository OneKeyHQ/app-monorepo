import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAdjustmentsVertical = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M17 2.75a.75.75 0 0 0-1.5 0v5.5a.75.75 0 0 0 1.5 0v-5.5zm0 13a.75.75 0 0 0-1.5 0v1.5a.75.75 0 0 0 1.5 0v-1.5zM3.75 15a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75zM4.5 2.75a.75.75 0 0 0-1.5 0v5.5a.75.75 0 0 0 1.5 0v-5.5zM10 11a.75.75 0 0 1 .75.75v5.5a.75.75 0 0 1-1.5 0v-5.5A.75.75 0 0 1 10 11zm.75-8.25a.75.75 0 0 0-1.5 0v1.5a.75.75 0 0 0 1.5 0v-1.5zM10 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm-6.25 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm12.5 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
  </Svg>
);
export default SvgAdjustmentsVertical;
