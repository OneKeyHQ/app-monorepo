import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMessageNotification = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M19 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm-2 4a2 2 0 1 1 4 0 2 2 0 0 1-4 0Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="M13 6c0-1.093.292-2.117.803-3H5.002a3 3 0 0 0-3 3v10.036a3 3 0 0 0 3 3h3.65l2.703 2.266a1 1 0 0 0 1.28.004l2.74-2.27h3.627a3 3 0 0 0 3-3v-4.84A6 6 0 0 1 13 6Z"
    />
  </Svg>
);
export default SvgMessageNotification;
