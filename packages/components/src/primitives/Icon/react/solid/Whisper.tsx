import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgWhisper = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M7 8a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm3 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm2 1a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
    />
    <Path
      fill="currentColor"
      d="M2 7a3 3 0 0 1 3-3h14a3 3 0 0 1 3 3v1a1 1 0 1 1-2 0V7a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h5a1 1 0 1 1 0 2H5a3 3 0 0 1-3-3V7Z"
    />
    <Path
      fill="currentColor"
      d="M18 11a1 1 0 0 1 1 1c0 1.267.282 1.95.665 2.335.384.383 1.068.665 2.335.665a1 1 0 1 1 0 2c-1.267 0-1.95.282-2.335.665C19.282 18.05 19 18.733 19 20a1 1 0 1 1-2 0c0-1.267-.282-1.95-.665-2.335C15.95 17.282 15.267 17 14 17a1 1 0 1 1 0-2c1.267 0 1.95-.282 2.335-.665.383-.384.665-1.068.665-2.335a1 1 0 0 1 1-1Z"
    />
  </Svg>
);
export default SvgWhisper;
