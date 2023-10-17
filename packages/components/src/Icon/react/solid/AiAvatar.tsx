import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgAiAvatar = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M18.947 1.894a.5.5 0 0 0-.894 0l-.979 1.957a.5.5 0 0 1-.223.224l-1.957.978a.5.5 0 0 0 0 .894l1.957.978a.5.5 0 0 1 .224.224l.978 1.957a.5.5 0 0 0 .894 0l.979-1.957a.5.5 0 0 1 .223-.224l1.957-.978a.5.5 0 0 0 0-.894l-1.957-.978a.5.5 0 0 1-.224-.224l-.978-1.957Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M5 6a1 1 0 0 1 1-1h5a1 1 0 1 0 0-2H6a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h12a3 3 0 0 0 3-3v-5a1 1 0 1 0-2 0v5a1 1 0 0 1-1 1h-1.1a5.002 5.002 0 0 0-9.8 0H6a1 1 0 0 1-1-1V6Z"
      clipRule="evenodd"
    />
    <Path fill="currentColor" d="M12 7.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z" />
  </Svg>
);
export default SvgAiAvatar;
