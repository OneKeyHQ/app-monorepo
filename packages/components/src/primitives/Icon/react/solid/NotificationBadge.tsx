import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgNotificationBadge = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M12.78 3A6.017 6.017 0 0 0 21 11.22V18a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h6.78Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M19.414 4.586a2 2 0 1 0-2.828 2.828 2 2 0 0 0 2.828-2.828Zm1.414-1.414a4 4 0 1 0-5.656 5.656 4 4 0 0 0 5.656-5.656Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgNotificationBadge;
