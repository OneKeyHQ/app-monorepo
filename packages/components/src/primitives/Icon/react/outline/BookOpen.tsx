import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBookOpen = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15 6a2 2 0 0 0-2 2v10.571A4.7 4.7 0 0 1 15.277 18H21V6zM3 18h5.723c.776 0 1.564.175 2.277.571V8a2 2 0 0 0-2-2H3zm20 0a2 2 0 0 1-2 2h-5.723c-.52 0-1 .126-1.4.373-.42.26-.761.632-.982 1.074a1 1 0 0 1-1.79 0 2.66 2.66 0 0 0-.982-1.074c-.4-.247-.88-.373-1.4-.373H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h6a4 4 0 0 1 3 1.355A4 4 0 0 1 15 4h6a2 2 0 0 1 2 2z" />
  </Svg>
);
export default SvgBookOpen;
