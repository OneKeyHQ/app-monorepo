// cspell:ignore abdk Certora Spearbit
import type { IPoolProtocolVersion } from '@onekeyhq/shared/types/pools';
import type {
  IEarnProtocolIntroAudit,
  IEarnProtocolIntroInfo,
  IEarnProtocolIntroInvestorRound,
} from '@onekeyhq/shared/types/staking';

// The DEX behind a pool, in the shape an Earn asset page's Protocol tab reads.
// The facts follow Uniswap's own posts: the raises on blog.uniswap.org
// (2020-08-06, 2022-10-13), the v4 security post (2024-11-26), and the audit
// reports in each version's repositories.

const UNISWAP_LOGO = 'https://uni.onekey-asset.com/static/logo/Uniswap.png';

const SUMMARY =
  'Uniswap is a decentralized exchange: anyone can swap tokens, or add them to a pool and earn its trading fees.';

const VERSION_NOTES: Record<IPoolProtocolVersion, string> = {
  v2: 'In v2, a pool’s liquidity covers every price, so it earns from every swap.',
  v3: 'In v3, LPs choose the price range their liquidity covers, and earn fees while the price is inside it.',
  v4: 'v4 keeps every pool in one contract and adds hooks: contracts that can change how a pool works, such as its fee.',
};

// Shown as written, so these are labels rather than keys
const VERSION_TAGS: Record<IPoolProtocolVersion, string[]> = {
  v2: ['DEX', 'AMM'],
  v3: ['DEX', 'AMM', 'Concentrated liquidity'],
  v4: ['DEX', 'AMM', 'Hooks'],
};

const FUNDING_ROUNDS: IEarnProtocolIntroInvestorRound[] = [
  {
    round: 'Series B',
    date: 'Oct 2022',
    amount: '$165M',
    investors:
      'Polychain Capital (lead), a16z crypto, Paradigm, SV Angel, Variant',
  },
  {
    round: 'Series A',
    date: 'Aug 2020',
    amount: '$11M',
    investors:
      'Andreessen Horowitz (lead), USV, Paradigm, Version One, Variant, Parafi Capital, SV Angel, A.Capital',
  },
  { round: 'Seed', date: '2019', investors: 'Paradigm' },
];

const V3_CORE = 'https://github.com/Uniswap/v3-core/blob/main/audits';
const V4_CORE =
  'https://github.com/Uniswap/v4-core/blob/main/docs/security/audits';
const V4_PERIPHERY = 'https://github.com/Uniswap/v4-periphery/blob/main/audits';

const VERSION_AUDITS: Record<IPoolProtocolVersion, IEarnProtocolIntroAudit[]> =
  {
    v2: [
      {
        title: 'dapp.org',
        date: 'Apr 2020',
        scope: 'Core contracts: code review and formal verification',
        url: 'https://dapp.org.uk/reports/uniswapv2.html',
      },
    ],
    v3: [
      {
        title: 'Trail of Bits',
        date: 'Mar 2021',
        scope: 'Core contracts',
        url: `${V3_CORE}/tob/audit.pdf`,
      },
      {
        title: 'ABDK',
        date: 'Mar 2021',
        scope: 'Core contracts',
        url: `${V3_CORE}/abdk/audit.pdf`,
      },
      {
        title: 'ABDK',
        date: 'Apr 2021',
        scope: 'Periphery contracts',
        url: 'https://github.com/Uniswap/v3-periphery/blob/main/audits/abdk/audit.pdf',
      },
    ],
    v4: [
      {
        title: 'OpenZeppelin',
        date: '2024',
        scope: 'Core contracts',
        url: `${V4_CORE}/OpenZeppelin_audit_core.pdf`,
      },
      {
        title: 'Trail of Bits',
        date: '2024',
        scope: 'Core contracts',
        url: `${V4_CORE}/TrailOfBits_audit_core.pdf`,
      },
      {
        title: 'Certora',
        date: '2024',
        scope: 'Core contracts',
        url: `${V4_CORE}/DRAFT_Certora_audit_core.pdf`,
      },
      {
        title: 'Spearbit',
        date: '2024',
        scope: 'Core contracts',
        url: `${V4_CORE}/DRAFT_Spearbit_audit_core.pdf`,
      },
      {
        title: 'ABDK',
        date: '2024',
        scope: 'Core contracts',
        url: `${V4_CORE}/DRAFT_ABDK_audit_core.pdf`,
      },
      {
        title: 'OpenZeppelin',
        date: '2024',
        scope: 'Periphery contracts and Universal Router',
        url: `${V4_PERIPHERY}/OpenZeppelin_audit_periphery_universal_router.pdf`,
      },
      {
        title: 'Spearbit',
        date: '2024',
        scope: 'Periphery contracts',
        url: `${V4_PERIPHERY}/DRAFT_Spearbit_audit_periphery.pdf`,
      },
      {
        title: 'ABDK',
        date: '2024',
        scope: 'Periphery contracts and Universal Router',
        url: `${V4_PERIPHERY}/DRAFT_ABDK_audit_periphery_universal_router.pdf`,
      },
      {
        // Named in Uniswap's post; the report is not in Uniswap's repositories
        title: 'Pashov Audit Group',
        date: '2024',
        url: 'https://blog.uniswap.org/v4-bug-bounty',
      },
    ],
  };

const VERSION_AUDIT_NOTES: Partial<Record<IPoolProtocolVersion, string[]>> = {
  v4: [
    'Before launch, v4 also ran a $2.35M security competition with over 500 researchers, and a $15.5M bug bounty.',
  ],
};

export function getPoolProtocolIntro(
  version: IPoolProtocolVersion,
): IEarnProtocolIntroInfo {
  return {
    items: [
      {
        title: 'Uniswap',
        logoURI: UNISWAP_LOGO,
        description: `${SUMMARY} ${VERSION_NOTES[version]}`,
        tags: VERSION_TAGS[version],
        metrics: [{ title: 'Founded', value: '2018' }],
        team: {
          title: 'Team',
          items: [{ name: 'Hayden Adams', position: 'Founder and CEO' }],
        },
        investors: {
          title: 'Investors',
          // The facts grid shows one short name, the latest round's lead;
          // the rounds open from it
          items: [{ title: 'Polychain Capital' }],
          button: {
            type: 'popup',
            data: { title: 'Investors', fundingRounds: FUNDING_ROUNDS },
          },
        },
        audits: {
          title: 'Audits',
          items: VERSION_AUDITS[version],
          ...(VERSION_AUDIT_NOTES[version]
            ? {
                button: {
                  type: 'popup',
                  data: { description: VERSION_AUDIT_NOTES[version] },
                },
              }
            : {}),
        },
        socialLinks: [
          { type: 'website', url: 'https://uniswap.org' },
          { type: 'x', url: 'https://x.com/Uniswap' },
          { type: 'link', title: 'Docs', url: 'https://docs.uniswap.org' },
        ],
      },
    ],
  };
}
