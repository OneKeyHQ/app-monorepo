import * as React from 'react';
import Svg, { SvgProps, Path } from 'react-native-svg';

function SvgGift(props: SvgProps) {
  return (
    <Svg viewBox="0 0 20 20" fill="currentColor" {...props}>
      <Path
        fillRule="evenodd"
        d="M5 5a3 3 0 015-2.236A3 3 0 0114.83 6H16a2 2 0 110 4h-5V9a1 1 0 10-2 0v1H4a2 2 0 110-4h1.17C5.06 5.687 5 5.35 5 5zm4 1V5a1 1 0 10-1 1h1zm3 0a1 1 0 10-1-1v1h1z"
        clipRule="evenodd"
      />
      <Path d="M9 11H3v5a2 2 0 002 2h4v-7zm2 7h4a2 2 0 002-2v-5h-6v7z" />
    </Svg>
  );
}

export default SvgGift;
