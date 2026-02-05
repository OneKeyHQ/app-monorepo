import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgThumbDown = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M9.803 4.105A1.99 1.99 0 0 1 11.585 3c1.84 0 3.24 1.647 2.957 3.462L14.148 9h3.862c2.421 0 4.279 2.142 3.953 4.54l-.68 5A3.99 3.99 0 0 1 17.33 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h2.38zM6 13H4v7h2z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgThumbDown;
