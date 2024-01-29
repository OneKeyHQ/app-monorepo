import { useState } from 'react';

import type { ISwitchProps } from '@onekeyhq/components';
import { Icon, SizableText, Stack, Switch } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';

import { Layout } from './utils/Layout';

const SwitchDemo = ({ ...rest }: ISwitchProps) => {
  const [val, setVal] = useState(false);

  return (
    <Switch
      value={val}
      onChange={() => {
        setVal(!val);
      }}
      {...rest}
    />
  );
};

export const TOKENDATA = [
  {
    src: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/btc.png',
    title: 'BTC',
    subtitle: '30.00 BTC',
    price: '$902,617.17',
    change: '+4.32%',
    state: 'unverified',
  },
  {
    src: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/eth.png',
    title: 'Ethereum',
    subtitle: '2.35 ETH',
    price: '$3,836.97',
    change: '+4.32%',
    state: 'unknown',
  },
  {
    src: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/matic.png',
    title: 'Polygon',
    subtitle: '2.35 Matic',
    price: '$10421.23',
    change: '-4.32%',
  },
];

export const NFTDATA = [
  {
    src: 'https://images.glow.app/https%3A%2F%2Farweave.net%2F0WFtaZrc_DUzL2Tt_zztq-9cfJoSDhDacSfrPT50HOo%3Fext%3Dpng?ixlib=js-3.8.0&w=80&h=80&dpr=2&fit=crop&s=7af3b8e6a74c4abc0ab9de93ca67d1c4',
    title: 'Critter Ywin',
    subtitle: 'Hyperspace · 6/27/23, 7:19 AM',
    amount: '3.186 SOL',
    value: '$52.82',
    networkSrc:
      'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/btc.png',
  },
  {
    src: 'https://images.glow.app/https%3A%2F%2Farweave.net%2FhRZG2ePVGpBSogaNSdp4Jm3vUILhvB-h3gB7-nRrPsE%3Fext%3Dpng?ixlib=js-3.8.0&w=80&h=80&dpr=2&fit=crop&s=cbd0b1bc0ab5d8b867930546c5e87358',
    title: 'Critter Yore',
    subtitle: 'Magic Eden · 5/23/23, 6:40 PM',
    amount: '3.186 SOL',
    value: '$52.82',
    networkSrc:
      'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/eth.png',
  },
  {
    src: 'https://images.glow.app/https%3A%2F%2Farweave.net%2F99eb109nC2JgMA5GHpW0GK8TdidO8lm5eDj0FgzfWdA%3Fext%3Dpng?ixlib=js-3.8.0&w=80&h=80&dpr=2&fit=crop&s=2ff9b1faad864bf338d0b881051f6c16',
    title: 'Critter Osar',
    subtitle: 'Magic Eden · 5/22/23, 1:33 PM',
    amount: '3.186 SOL',
    value: '$52.82',
    networkSrc:
      'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/matic.png',
  },
  {
    src: '',
    title: 'Critter Osa',
    subtitle: 'Magic Eden · 5/22/23, 1:33 PM',
    amount: '3.186 SOL',
    value: '$52.82',
    networkSrc: '',
  },
];

const ListItemGallery = () => (
  <Layout
    description=".."
    suggestions={['...']}
    boundaryConditions={['...']}
    elements={[
      {
        title: 'Token',
        element: (
          <Stack mx="$-5">
            {TOKENDATA.map((item) => (
              <ListItem
                key={item.title}
                title={item.title}
                subtitle={item.subtitle}
                avatarProps={{
                  src: item.src,
                  cornerIconProps: item.state
                    ? {
                        name:
                          item.state === 'unverified'
                            ? 'ErrorSolid'
                            : 'QuestionmarkSolid',
                        color:
                          item.state === 'unverified'
                            ? '$iconCritical'
                            : '$iconCaution',
                      }
                    : undefined,
                }}
                onPress={() => {
                  console.log('clicked');
                }}
              >
                <ListItem.Text
                  align="right"
                  primary={item.price}
                  secondary={item.change}
                  secondaryTextProps={{
                    color:
                      parseFloat(item.change) >= 0
                        ? '$textSuccess'
                        : '$textCritical',
                  }}
                />
              </ListItem>
            ))}
          </Stack>
        ),
      },
      {
        title: 'NFT',
        element: (
          <Stack mx="$-5">
            {NFTDATA.map((item) => (
              <ListItem
                key={item.title}
                title={item.title}
                subtitle={item.subtitle}
                subtitleProps={{
                  numberOfLines: 1,
                }}
                avatarProps={{
                  src: item.src,
                  fallbackProps: {
                    bg: '$bgStrong',
                    justifyContent: 'center',
                    alignItems: 'center',
                    children: <Icon name="ImageMountainSolid" />,
                  },
                  cornerImageProps: item.networkSrc
                    ? { src: item.networkSrc }
                    : undefined,
                }}
                onPress={() => {
                  console.log('clicked');
                }}
              >
                <ListItem.Text
                  align="right"
                  primary={item.amount}
                  secondary={item.value}
                />
              </ListItem>
            ))}
          </Stack>
        ),
      },
      {
        title: 'Leading Icon & Drill In',
        element: (
          <Stack mx="$-5">
            <ListItem
              icon="PlaceholderOutline"
              title="Item 1"
              drillIn
              onPress={() => {
                console.log('clicked');
              }}
            >
              <ListItem.Text
                primary="Detail"
                align="right"
                primaryTextProps={{}}
              />
            </ListItem>
            <ListItem
              icon="PlaceholderOutline"
              title="Item 2"
              drillIn
              onPress={() => {
                console.log('clicked');
              }}
            >
              <ListItem.Text
                primary="Detail"
                align="right"
                primaryTextProps={{}}
              />
            </ListItem>
            <ListItem
              icon="PlaceholderOutline"
              title="Item 3"
              drillIn
              onPress={() => {
                console.log('clicked');
              }}
            >
              <ListItem.Text
                primary="Detail"
                align="right"
                primaryTextProps={{}}
              />
            </ListItem>
          </Stack>
        ),
      },
      {
        title: 'Checkmark',
        element: (
          <Stack mx="$-5">
            <ListItem
              title="EVM #1"
              subtitle="OxadE9..A57b · 0.006448ETH"
              checkMark
            />
            <ListItem
              title="EVM #2"
              subtitle="OxadE9..A57b · 0.006448ETH"
              onPress={() => {
                console.log('clicked');
              }}
            />
            <ListItem
              title="EVM #3"
              subtitle="OxadE9..A57b · 0.006448ETH"
              onPress={() => {
                console.log('clicked');
              }}
            />
          </Stack>
        ),
      },
      {
        title: 'Switch as trailing',
        element: (
          <Stack mx="$-5">
            <ListItem icon="WifiOutline" title="Wifi">
              <SwitchDemo />
            </ListItem>
            <ListItem icon="BluetoothOutline" title="Bluetooth">
              <SwitchDemo />
            </ListItem>
          </Stack>
        ),
      },
      {
        title: 'Trailing action',
        element: (
          <Stack mx="$-5">
            <ListItem title="EVM#1" subtitle="OxadE9..A57b · 0.006448ETH">
              <ListItem.IconButton icon="StarOutline" />
            </ListItem>
            <ListItem title="EVM#2" subtitle="OxadE9..A57b · 0.006448ETH">
              <ListItem.IconButton
                icon="StarSolid"
                iconProps={{
                  color: '$iconActive',
                }}
              />
            </ListItem>
          </Stack>
        ),
      },
      {
        title: 'render Props',
        element: (
          <Stack mx="$-5">
            <ListItem title="EVM#2" subtitle="OxadE9..A57b · 0.006448ETH">
              <ListItem.IconButton
                icon="StarSolid"
                iconProps={{
                  color: '$iconActive',
                }}
              />
            </ListItem>
            <ListItem
              renderAvatar={<SizableText>avatar</SizableText>}
              renderIcon={<SizableText>icon</SizableText>}
              // renderItemText={<SizableText>ItemTet</SizableText>}
              title="EVM#1"
              subtitle="OxadE9..A57b · 0.006448ETH"
            >
              <ListItem.IconButton icon="StarOutline" />
            </ListItem>
          </Stack>
        ),
      },
    ]}
  />
);

export default ListItemGallery;
