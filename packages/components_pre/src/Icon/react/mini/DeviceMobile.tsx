import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgDeviceMobile = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M7 2a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H7zm3 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgDeviceMobile;
