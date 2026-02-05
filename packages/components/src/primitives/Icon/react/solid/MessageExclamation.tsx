import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgMessageExclamation = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M19.002 3h-14a2 2 0 0 0-2 2v12.036a2 2 0 0 0 2 2h3.65l2.704 2.266a1 1 0 0 0 1.28.004l2.74-2.27h3.626a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2M12 7.5a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0v-2a1 1 0 0 1 1-1m0 4.75a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMessageExclamation;
