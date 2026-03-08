import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgVolumeFullOn = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M13 20.929 5.747 17H1V7h4.747L13 3.071V20.93ZM6.477 8.879 6.254 9H3v6h3.254l.223.121L11 17.571V6.43L6.477 8.88Z"
      clipRule="evenodd"
    />
    <Path d="M19.778 4.222A10.97 10.97 0 0 1 23 12c0 3.037-1.232 5.789-3.222 7.778l-1.414-1.414A8.97 8.97 0 0 0 21 12a8.97 8.97 0 0 0-2.636-6.364z" />
    <Path d="M16.597 7.403A6.48 6.48 0 0 1 18.5 12a6.48 6.48 0 0 1-1.903 4.597l-1.415-1.415A4.48 4.48 0 0 0 16.5 12a4.48 4.48 0 0 0-1.318-3.182z" />
  </Svg>
);
export default SvgVolumeFullOn;
