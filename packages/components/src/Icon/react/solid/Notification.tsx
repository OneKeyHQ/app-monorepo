import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgNotification = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M12 2a7.853 7.853 0 0 0-7.784 6.815l-.905 6.789A3 3 0 0 0 6.284 19h1.07c.904 1.748 2.607 3 4.646 3 2.039 0 3.742-1.252 4.646-3h1.07a3 3 0 0 0 2.973-3.396l-.905-6.789A7.853 7.853 0 0 0 12 2Zm2.222 17H9.778c.61.637 1.399 1 2.222 1s1.613-.363 2.222-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgNotification;
