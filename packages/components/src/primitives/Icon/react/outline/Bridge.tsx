import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBridge = (props: SvgProps) => (
  <Svg
    viewBox="0 0 24 24"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M12 6a7 7 0 0 0-7 7 1 1 0 1 1-2 0 9 9 0 0 1 18 0 1 1 0 1 1-2 0 7 7 0 0 0-7-7ZM6 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0ZM20 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
  </Svg>
);
export default SvgBridge;
