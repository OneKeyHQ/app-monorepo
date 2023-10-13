import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgNotificationOff = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="m20.82 16.576-1.035-7.76a7.853 7.853 0 0 0-12.19-5.464l13.224 13.224Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M3.707 2.293a1 1 0 0 0-1.414 1.414l2.666 2.666a7.842 7.842 0 0 0-.743 2.442l-.905 6.789A3 3 0 0 0 6.284 19h1.07c.904 1.748 2.607 3 4.646 3 2.038 0 3.742-1.252 4.646-3h.94l2.707 2.707a1 1 0 0 0 1.414-1.414l-18-18ZM14.221 19H9.778c.61.637 1.399 1 2.222 1s1.613-.363 2.221-1Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgNotificationOff;
