import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAltText = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6Zm2 9v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3H5Zm14-2V6a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v3.586l.879-.879a3 3 0 0 1 4.242 0L14.414 13H19Zm-6-4.5a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0ZM6 17a1 1 0 0 1 1-1h5a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1Zm8 0a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2h-2a1 1 0 0 1-1-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAltText;
