import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgExpandWindow = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M6 5a1 1 0 0 0-1 1v4a1 1 0 1 1-2 0V6a3 3 0 0 1 3-3h13a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-4a1 1 0 1 1 0-2h4a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H6Zm8 4a1 1 0 1 1 0-2h3a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0v-.586l-1.293 1.293a1 1 0 0 1-1.414-1.414L14.586 9H14ZM2 16a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-3Zm3-1a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1H5Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgExpandWindow;
