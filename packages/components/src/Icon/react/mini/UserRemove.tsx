import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgUserRemove = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M11 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm3 11a6 6 0 0 0-12 0h12zm-1-9a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2h-4z" />
  </Svg>
);
export default SvgUserRemove;
