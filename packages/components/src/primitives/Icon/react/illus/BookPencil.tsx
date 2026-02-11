import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgBookPencil = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 180 180" accessibilityRole="image" {...props}>
    <Path
      fill="#fff"
      stroke="#000"
      d="M45.614 25.889A5.8 5.8 0 0 1 48.696 25h85.815v112l-4 3-86.966-3-.53-106.38a5.56 5.56 0 0 1 2.599-4.731Z"
    />
    <Path
      fill="#fff"
      stroke="#000"
      d="M43.04 32.014a3 3 0 0 1 3-3.014h83.487v111h-86z"
    />
    <Path
      fill="#fff"
      stroke="#000"
      d="m43.027 32.06 19 6.94.5 107.998-19-6.941z"
    />
    <Path
      fill="#000"
      stroke="#000"
      strokeLinejoin="round"
      strokeMiterlimit={2}
      d="M130.034 28.939 135 26v111l-5 3z"
    />
    <Path
      fill="#fff"
      stroke="#000"
      d="m148.871 87.683-32.75 56.725a.5.5 0 0 1-.683.183l-7.795-4.5a.5.5 0 0 1-.183-.683l32.75-56.725z"
    />
    <Path
      fill="#fff"
      stroke="#000"
      d="m115.603 144.686-8.753 5.78.628-10.471z"
    />
    <Path
      fill="#3EDC2F"
      stroke="#000"
      strokeMiterlimit={16}
      d="M131.5 38.5h9v27h-9z"
    />
  </Svg>
);
export default SvgBookPencil;
