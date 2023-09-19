import Svg, { Path } from 'react-native-svg';

import type { SvgProps } from 'react-native-svg';

const SvgTerra = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 16 16" accessibilityRole="image" {...props}>
    <Path
      fill="#8C8CA1"
      fillRule="evenodd"
      d="M2.262 10.476a5.632 5.632 0 0 0 2.18 2.947c2.713 1.904 6.096 1.095 8.219-1.178.046-.047 0-.13-.063-.104-.378.177-.82.244-1.276.161a2.048 2.048 0 0 1-1.624-1.624 2.07 2.07 0 0 1 1.453-2.392l-1.095-.135-7.79 2.325h-.004Z"
      clipRule="evenodd"
    />
    <Path
      fill="#8C8CA1"
      fillRule="evenodd"
      d="M9.5 1.556c-.3.737-1.463 1.022-2.143 1.214-.705.207-1.551.519-2.252.887a5.751 5.751 0 0 0-2.838 6.824c.633 1.79 2.511 2.501 4.525 1.717 1.157-.451 1.447-.804 2.164-2.044.487-.846 1.193-1.53 2.153-1.847.8-.26 1.842-.218 2.818-.016.057.01.104-.057.062-.104a3.54 3.54 0 0 0-3.446-1.079 3.385 3.385 0 0 0-.934.374c-.14.077-.29.155-.446.223a2.263 2.263 0 0 1-.3.098c-.193.047-.39.073-.587.073-.644 0-1.256-.29-1.614-.83-.607-.914-.317-2.019.597-2.626.596-.368 1.266-.597 1.806-1.11.498-.467.695-.867.575-1.734a.067.067 0 0 0-.13-.02H9.5Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTerra;
