import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgGiftcard = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M13 4H5a3 3 0 0 0-3 3v4h9.586l-1.293-1.293a1 1 0 1 1 1.414-1.414L13 9.586V4ZM2 13v4a3 3 0 0 0 3 3h8v-5.586l-1.293 1.293a1 1 0 0 1-1.414-1.414L11.586 13H2Zm13 7h4a3 3 0 0 0 3-3v-4h-5.586l1.293 1.293a1 1 0 0 1-1.414 1.414L15 14.414V20Zm7-9V7a3 3 0 0 0-3-3h-4v5.586l1.293-1.293a1 1 0 1 1 1.414 1.414L16.414 11H22Z"
    />
  </Svg>
);
export default SvgGiftcard;
