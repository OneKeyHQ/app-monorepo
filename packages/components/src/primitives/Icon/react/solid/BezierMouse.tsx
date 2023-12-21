import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgBezierMouse = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M11.536 13.39a1.5 1.5 0 0 1 1.854-1.854l6.452 1.843c1.294.37 1.484 2.125.3 2.763l-2.6 1.4-1.4 2.6c-.638 1.184-2.393.994-2.763-.3l-1.843-6.452Zm2.17.316 1.258 4.404.888-1.648a1.5 1.5 0 0 1 .61-.61l1.648-.888-4.404-1.258Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="M5 3a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2v6a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2h1a1 1 0 1 0 0-2H9a2 2 0 0 0-2-2V9a2 2 0 0 0 2-2h6a2 2 0 0 0 2 2v1a1 1 0 1 0 2 0V9a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2H9a2 2 0 0 0-2-2H5Z"
    />
  </Svg>
);
export default SvgBezierMouse;
