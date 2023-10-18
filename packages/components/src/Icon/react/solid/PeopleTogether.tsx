import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgPeopleTogether = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M3.5 7a4 4 0 1 1 8 0 4 4 0 0 1-8 0Zm9 0a4 4 0 1 1 8 0 4 4 0 0 1-8 0Zm-5 5c2.87 0 5.594 1.98 6.607 5.613.53 1.9-1.09 3.387-2.753 3.387H3.646C1.983 21 .362 19.513.892 17.613 1.906 13.981 4.63 12 7.5 12Zm8.534 5.076c-.487-1.748-1.326-3.227-2.404-4.374A6.228 6.228 0 0 1 16.5 12c2.871 0 5.594 1.98 6.608 5.613.53 1.9-1.09 3.387-2.753 3.387H15.33a4.489 4.489 0 0 0 .703-3.924Z"
    />
  </Svg>
);
export default SvgPeopleTogether;
