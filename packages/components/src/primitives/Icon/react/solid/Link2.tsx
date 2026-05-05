import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgLink2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M6.464 9.122a5 5 0 0 1 7.072 0l.343.343a5 5 0 0 1 1.425 2.911l.124.992-1.984.25-.124-.993a3 3 0 0 0-.856-1.746l-.342-.343a3 3 0 0 0-4.243 0L4.536 13.88a3 3 0 0 0 0 4.243l.343.343a3 3 0 0 0 4.243 0l.878-.879L11.415 19l-.88.879a5 5 0 0 1-7.07 0l-.343-.343a5 5 0 0 1 0-7.071z" />
    <Path d="M13.464 5.122a5 5 0 0 1 7.072 0l.342.343a5 5 0 0 1 0 7.071l-3.342 3.343a5 5 0 0 1-7.072 0l-.342-.343a5 5 0 0 1-1.426-2.91l-.124-.993 1.984-.25.124.993c.08.639.365 1.255.856 1.746l.343.343a3 3 0 0 0 4.243 0l3.343-3.343a3 3 0 0 0 0-4.243l-.343-.343a3 3 0 0 0-4.243 0l-.878.88L12.586 6z" />
  </Svg>
);
export default SvgLink2;
