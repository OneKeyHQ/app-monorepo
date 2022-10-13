import Svg, { SvgProps, Path } from 'react-native-svg';

const SvgDocumentDuplicate = (props: SvgProps) => (
  <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
    <Path d="M9 2a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V6.414A2 2 0 0 0 16.414 5L14 2.586A2 2 0 0 0 12.586 2H9z" />
    <Path d="M3 8a2 2 0 0 1 2-2v10h8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z" />
  </Svg>
);

export default SvgDocumentDuplicate;
