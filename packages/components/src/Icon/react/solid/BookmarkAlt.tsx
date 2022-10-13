import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgBookmarkAlt = (props: SvgProps) => (
  <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
    <Path
      fillRule="evenodd"
      d="M3 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5zm11 1H6v8l4-2 4 2V6z"
      clipRule="evenodd"
    />
  </Svg>
);

export default SvgBookmarkAlt;
