import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgKey2 = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M15.5 7a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3" />
    <Path
      fillRule="evenodd"
      d="M15.5 2a6.5 6.5 0 1 1 0 13c-.342 0-.677-.03-1.006-.081l-1.58 1.581H11v1.914L8.414 21H3v-5.414l6.08-6.081A6.5 6.5 0 0 1 15.5 2m0 2a4.5 4.5 0 0 0-4.366 5.595l.136.549-.399.4L5 16.414V19h2.586L9 17.586V14.5h3.086l1.37-1.371.4-.4.55.137A4.5 4.5 0 1 0 15.5 4"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgKey2;
