import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgAlt = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M10.766 15H8.915l-.311-1.191H6.81L6.499 15h-1.85l1.955-5.99h2.208zm-3.631-2.433H8.28l-.556-2.129H7.69l-.555 2.13Z"
      clipRule="evenodd"
    />
    <Path d="M12.896 13.605h2.35V15h-4.11V9.01h1.76zm6.396-3.2h-1.577V15h-1.76v-4.595h-1.577V9.011h4.914z" />
    <Path
      fillRule="evenodd"
      d="M22 20H2V4h20zM4 18h16V6H4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgAlt;
