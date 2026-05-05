import Svg, { Path } from 'react-native-svg';
import type { SvgProps } from 'react-native-svg';
const SvgOculus = (props: SvgProps) => (
  <Svg
    fill="currentColor"
    viewBox="0 0 24 24"
    accessibilityRole="image"
    {...props}
  >
    <Path d="M14 10h-4V8h4z" />
    <Path
      fillRule="evenodd"
      d="M16.565 5a5.99 5.99 0 0 1 5.311 3.209l.624-.623L23.914 9l-1.375 1.374c.238 1.808-.073 3.799-.952 5.416-.985 1.812-2.726 3.21-5.189 3.21H7.601c-2.463 0-4.204-1.398-5.189-3.21-.879-1.618-1.19-3.61-.953-5.417L.086 9 1.5 7.586l.622.622A6 6 0 0 1 7.434 5zM7.434 7a4 4 0 0 0-3.925 3.222c-.3 1.52-.068 3.273.66 4.613C4.88 16.143 6.018 17 7.6 17h8.797c1.583 0 2.721-.857 3.432-2.165.729-1.34.96-3.094.661-4.613A4.004 4.004 0 0 0 16.565 7z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgOculus;
