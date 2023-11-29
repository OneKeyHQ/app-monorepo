import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAiAvatar = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M6 5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h1.1a5.002 5.002 0 0 1 9.8 0H18a1 1 0 0 0 1-1v-5a1 1 0 1 1 2 0v5a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h5a1 1 0 1 1 0 2H6Zm3.17 14h5.66a3.001 3.001 0 0 0-5.66 0ZM12 9a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm-3.5 1.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0Z"
      clipRule="evenodd"
    />
    <Path
      fill="currentColor"
      d="M18.947 1.894a.5.5 0 0 0-.894 0l-.979 1.957a.5.5 0 0 1-.223.224l-1.957.978a.5.5 0 0 0 0 .894l1.957.978a.5.5 0 0 1 .224.224l.978 1.957a.5.5 0 0 0 .894 0l.979-1.957a.5.5 0 0 1 .223-.224l1.957-.978a.5.5 0 0 0 0-.894l-1.957-.978a.5.5 0 0 1-.224-.224l-.978-1.957Z"
    />
  </Svg>
);
export default SvgAiAvatar;
