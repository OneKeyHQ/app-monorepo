import Svg, { Rect, Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgWalletOpenDark = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 180 180" accessibilityRole="image" {...props}>
    <Rect
      width={98}
      height={101}
      x={44}
      y={35}
      fill="#000"
      stroke="#fff"
      rx={5}
    />
    <Path fill="#000" stroke="#4D4D4D" d="M50 44h83v85H50z" />
    <Path fill="#1B1B1B" stroke="#fff" d="M56 49h71v11H56z" />
    <Path fill="#4D4D4D" stroke="#fff" d="M56 60h71v11H56z" />
    <Path fill="#7F7F7F" stroke="#fff" d="M56 71h71v51H56z" />
    <Path
      fill="#000"
      stroke="#fff"
      d="M44 39.352c0-3.289 3.542-5.36 6.408-3.748l31.043 17.462A5 5 0 0 1 84 57.424v92.527c0 3.824-4.118 6.232-7.451 4.357l-27.452-15.441A10 10 0 0 1 44 130.151z"
    />
    <Path fill="#000" d="M48 35.5h24v2H48z" />
    <Path
      fill="#C6D5E0"
      d="M75.5 96.924c0-2.247 2.38-3.696 4.376-2.666l8.417 4.345A5 5 0 0 1 91 103.046v16.03c0 2.247-2.38 3.696-4.376 2.665l-8.417-4.344a5 5 0 0 1-2.707-4.443z"
    />
    <Path
      fill="#000"
      d="M75.5 96.924c0-2.247 2.38-3.696 4.376-2.666l8.417 4.345A5 5 0 0 1 91 103.046v16.03c0 2.247-2.38 3.696-4.376 2.665l-8.417-4.344a5 5 0 0 1-2.707-4.443z"
    />
    <Path
      stroke="#fff"
      d="M75.5 96.924c0-2.247 2.38-3.696 4.376-2.666l8.417 4.345A5 5 0 0 1 91 103.046v16.03c0 2.247-2.38 3.696-4.376 2.665l-8.417-4.344a5 5 0 0 1-2.707-4.443z"
    />
  </Svg>
);
export default SvgWalletOpenDark;
