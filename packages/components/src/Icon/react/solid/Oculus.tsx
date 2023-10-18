import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgOculus = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M2.119 8.214A5.995 5.995 0 0 1 7.434 5h9.132a5.995 5.995 0 0 1 5.315 3.214 1 1 0 0 1 1.326 1.493l-.665.665c.238 1.808-.075 3.8-.954 5.418-.985 1.812-2.726 3.21-5.189 3.21H7.601c-2.463 0-4.204-1.398-5.189-3.21-.879-1.618-1.192-3.61-.954-5.417l-.665-.666a1 1 0 0 1 1.326-1.493ZM13 8h-2a1 1 0 1 0 0 2h2a1 1 0 1 0 0-2Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgOculus;
