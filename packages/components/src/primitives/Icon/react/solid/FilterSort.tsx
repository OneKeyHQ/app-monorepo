import Svg, { SvgProps, Path } from 'react-native-svg';
const SvgFilterSort = (props: SvgProps) => (
  <Svg fill="none" viewBox="0 0 24 24" accessibilityRole="image" {...props}>
    <Path
      fill="currentColor"
      d="M6.002 4a1 1 0 0 1 1 1v11.585l1.29-1.292a1 1 0 0 1 1.415 1.414l-2.998 3a1 1 0 0 1-1.414 0l-3.002-3a1 1 0 1 1 1.414-1.414l1.295 1.294V5a1 1 0 0 1 1-1ZM12 6a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2h-8Zm4 10a1 1 0 1 0 0 2h4a1 1 0 1 0 0-2h-4Zm-3-4a1 1 0 0 1 1-1h6a1 1 0 1 1 0 2h-6a1 1 0 0 1-1-1Z"
    />
  </Svg>
);
export default SvgFilterSort;
