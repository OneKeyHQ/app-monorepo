import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgEnvelopeOpen = (props: SvgProps) => (
  <Svg
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-hidden="true"
    accessibilityRole="image"
    {...props}
  >
    <Path
      fillRule="evenodd"
      d="M2.106 6.447A2 2 0 0 0 1 8.237V16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8.236a2 2 0 0 0-1.106-1.789l-7-3.5a2 2 0 0 0-1.788 0l-7 3.5zm1.48 4.007a.75.75 0 0 0-.671 1.342l5.855 2.928a2.75 2.75 0 0 0 2.46 0l5.852-2.926a.75.75 0 1 0-.67-1.342l-5.853 2.926a1.25 1.25 0 0 1-1.118 0l-5.856-2.928z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgEnvelopeOpen;
