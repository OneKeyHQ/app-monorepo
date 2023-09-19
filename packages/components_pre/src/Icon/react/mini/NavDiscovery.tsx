import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgNavDiscovery = (props: SvgProps) => (
  <Svg
    viewBox="0 0 24 24"
    fill="currentColor"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M2 12C2 6.48 6.47 2 12 2c5.52 0 10 4.48 10 10 0 5.53-4.48 10-10 10-5.53 0-10-4.47-10-10Zm12.23 1.83 1.62-5.12a.45.45 0 0 0-.56-.57l-5.12 1.6c-.21.07-.38.23-.44.44l-1.6 5.13c-.11.34.22.67.56.56l5.1-1.6c.21-.06.38-.23.44-.44Z"
    />
  </Svg>
);
export default SvgNavDiscovery;
