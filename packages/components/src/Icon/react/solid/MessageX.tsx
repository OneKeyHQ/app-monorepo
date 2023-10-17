import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMessageX = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6.002 3h12a3 3 0 0 1 3 3v10.036a3 3 0 0 1-3 3h-2.626l-2.74 2.27a1 1 0 0 1-1.28-.004l-2.704-2.266h-2.65a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Zm8.705 6.707a1 1 0 0 0-1.414-1.414L12 9.586l-1.293-1.293a1 1 0 0 0-1.414 1.414L10.586 11l-1.293 1.293a1 1 0 1 0 1.414 1.414L12 12.414l1.293 1.293a1 1 0 0 0 1.414-1.414L13.414 11l1.293-1.293Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMessageX;
