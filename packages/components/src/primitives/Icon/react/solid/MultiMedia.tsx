import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgMultiMedia = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M6.25 7.5a1.25 1.25 0 1 0 0-2.5 1.25 1.25 0 0 0 0 2.5Z"
    />
    <Path
      fill="currentColor"
      fillRule="evenodd"
      d="M5 2a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h3v3a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-8a3 3 0 0 0-3-3h-3V5a3 3 0 0 0-3-3H5Zm9 6V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v5.131l.336-.224a3 3 0 0 1 3.328 0l.443.296A3.001 3.001 0 0 1 11 8h3Zm-6 4.535-1.445-.964a1 1 0 0 0-1.11 0L4 12.535V13a1 1 0 0 0 1 1h3v-1.465Zm6.136 4.784A.75.75 0 0 1 13 16.675v-3.35a.75.75 0 0 1 1.136-.643l2.792 1.675a.75.75 0 0 1 0 1.286l-2.792 1.675Z"
      clipRule="evenodd"
    />
  </Svg>
);
export default SvgMultiMedia;
