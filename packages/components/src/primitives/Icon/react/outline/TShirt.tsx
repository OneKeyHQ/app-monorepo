import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgTShirt = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="m23.24 6.535-2.137 6.411L19 12.027V21H5v-8.972l-2.103.92L.761 6.534 9.617 2.74l.334 1.046.002.003.018.047a3.5 3.5 0 0 0 .48.844c.357.455.846.82 1.549.82s1.192-.365 1.549-.82a3.5 3.5 0 0 0 .498-.89l.002-.005-.001.001.335-1.046zm-7.757-1.148c-.1.167-.22.346-.36.525C14.537 6.66 13.526 7.5 12 7.5s-2.537-.839-3.123-1.587a6 6 0 0 1-.361-.525l-5.278 2.26.864 2.59L7 8.972v10.027h10V8.972l2.898 1.265.863-2.59z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgTShirt;
