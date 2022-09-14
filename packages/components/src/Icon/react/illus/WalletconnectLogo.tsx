import * as React from 'react';
import Svg, { SvgProps, G, Path, Defs, ClipPath } from 'react-native-svg';

function SvgWalletconnectLogo(props: SvgProps) {
  return (
    <Svg viewBox="0 0 20 20" fill="none" {...props}>
      <G clipPath="url(#walletconnect-logo_svg__clip0_1296_23279)">
        <Path
          d="M4.097 6.395c3.262-3.193 8.55-3.193 11.811 0l.393.384a.403.403 0 010 .579l-1.343 1.314a.212.212 0 01-.295 0l-.54-.529c-2.276-2.227-5.965-2.227-8.24 0l-.579.567a.212.212 0 01-.295 0L3.666 7.395a.403.403 0 010-.578l.431-.422zm14.588 2.719l1.195 1.17a.403.403 0 010 .578l-5.388 5.276a.424.424 0 01-.591 0l-3.825-3.744a.106.106 0 00-.147 0l-3.825 3.744a.424.424 0 01-.59 0l-5.39-5.276a.403.403 0 010-.578l1.196-1.17a.424.424 0 01.59 0l3.825 3.744c.04.04.107.04.148 0l3.824-3.744a.424.424 0 01.59 0l3.825 3.744c.041.04.107.04.148 0l3.825-3.744a.424.424 0 01.59 0z"
          fill="#3B99FC"
        />
      </G>
      <Defs>
        <ClipPath id="walletconnect-logo_svg__clip0_1296_23279">
          <Path fill="#fff" d="M0 0h20v20H0z" />
        </ClipPath>
      </Defs>
    </Svg>
  );
}

export default SvgWalletconnectLogo;
