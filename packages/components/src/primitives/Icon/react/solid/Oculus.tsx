import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgOculus = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M16.566 5c2.32 0 4.312 1.31 5.312 3.208l.622-.622L23.914 9l-1.372 1.372c.238 1.808-.075 3.8-.954 5.418-.985 1.812-2.726 3.21-5.189 3.21H7.601c-2.463 0-4.204-1.398-5.189-3.21-.88-1.618-1.192-3.61-.954-5.418L.086 9 1.5 7.586l.622.622A6 6 0 0 1 7.435 5zM10 10h4V8h-4z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgOculus;
