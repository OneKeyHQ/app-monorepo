import {
  isConformingNamespaces,
  isValidNamespaces,
  isValidRequiredNamespaces,
} from '@walletconnect/utils';

import type { IWalletConnectChainInfo } from '@onekeyhq/shared/src/walletConnect/types';
import type { IConnectionAccountInfo } from '@onekeyhq/shared/types/dappConnection';

import ServiceWalletConnect from './ServiceWalletConnect';

import type { WalletKitTypes } from '@reown/walletkit';
import type { ProposalTypes } from '@walletconnect/types';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: unknown) => target,
  backgroundMethod:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  toastIfError:
    () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
}));

jest.mock('../ServiceBase', () => ({
  __esModule: true,
  default: class {
    backgroundApi: unknown;

    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));

jest.mock('./WalletConnectDappSide', () => ({
  WalletConnectDappSide: jest.fn(),
}));

const evmAccount: IConnectionAccountInfo = {
  networkImpl: 'evm',
  networkId: 'evm--1',
  accountId: 'test-account',
  address: '0x0000000000000000000000000000000000000001',
  walletId: 'test-wallet',
  indexedAccountId: 'test-indexed-account',
  othersWalletAccountId: undefined,
  deriveType: 'default',
  focusedWallet: 'test-wallet',
};

const evmNamespace: ProposalTypes.RequiredNamespace = {
  chains: ['eip155:1'],
  methods: ['eth_sendTransaction', 'personal_sign'],
  events: ['chainChanged', 'accountsChanged'],
};

const solanaChain = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
const algoChain = 'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k';
const unsupportedAlgoChain = 'algorand:unsupported';
const algoAccount: IConnectionAccountInfo = {
  ...evmAccount,
  networkImpl: 'algo',
  networkId: 'algo--4160',
  address: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ',
};
const algoNamespace: ProposalTypes.RequiredNamespace = {
  chains: [algoChain],
  methods: ['algo_signTxn'],
  events: ['accountsChanged', 'chainChanged'],
};
const inheritedNamespaceKeys = ['toString', 'constructor', '__proto__'];

function createProposal(
  optionalNamespaces: ProposalTypes.OptionalNamespaces,
  requiredNamespaces: ProposalTypes.RequiredNamespaces = {},
): WalletKitTypes.SessionProposal {
  return {
    id: 1,
    params: {
      id: 1,
      requiredNamespaces,
      optionalNamespaces,
      relays: [{ protocol: 'irn' }],
      proposer: {
        publicKey: 'test-public-key',
        metadata: {
          name: 'Test DApp',
          description: 'WalletConnect namespace regression test',
          url: 'https://example.com',
          icons: [],
        },
      },
      expiryTimestamp: 2_000_000_000,
      pairingTopic: 'test-pairing-topic',
    },
    verifyContext: {
      verified: {
        origin: 'https://example.com',
        validation: 'UNKNOWN',
        verifyUrl: 'https://verify.walletconnect.org',
      },
    },
  };
}

describe('ServiceWalletConnect namespace approval', () => {
  let service: ServiceWalletConnect;

  beforeEach(() => {
    service = new ServiceWalletConnect({ backgroundApi: {} });
    jest.spyOn(service, 'getAllChains').mockResolvedValue([
      ...['1', '8453'].map<IWalletConnectChainInfo>((chainId) => ({
        chainId,
        networkId: `evm--${chainId}`,
        wcNamespace: 'eip155',
        networkName: 'Test EVM',
        wcChain: `eip155:${chainId}`,
      })),
      {
        chainId: algoChain.split(':')[1],
        networkId: 'algo--4160',
        wcNamespace: 'algorand',
        networkName: 'Algorand',
        wcChain: algoChain,
      },
    ]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(inheritedNamespaceKeys)(
    'omits inherited optional namespace %s from approval',
    async (namespace) => {
      const optionalNamespaces = {
        [namespace]: { chains: [`${namespace}:1`], methods: [], events: [] },
      };
      const proposal = createProposal(optionalNamespaces, {
        eip155: evmNamespace,
      });

      expect(
        isValidRequiredNamespaces(
          optionalNamespaces,
          'proposal()',
          'optionalNamespaces',
        ),
      ).toBeNull();

      const namespaces = await service.buildWalletConnectNamespace({
        proposal,
        accountsInfo: [evmAccount],
      });

      expect(Object.keys(namespaces)).toEqual(['eip155']);
      expect(Object.getPrototypeOf(namespaces)).toBe(Object.prototype);
      expect(isValidNamespaces(namespaces, 'approve()')).toBeNull();
      expect(
        isConformingNamespaces(
          proposal.params.requiredNamespaces,
          namespaces,
          'approve()',
        ),
      ).toBeNull();
    },
  );

  it.each(inheritedNamespaceKeys)(
    'omits inherited optional namespace %s from account selection',
    async (namespace) => {
      const proposal = createProposal(
        {
          [namespace]: { chains: [`${namespace}:1`], methods: [], events: [] },
        },
        { eip155: evmNamespace },
      );

      await expect(
        service.getSessionApprovalAccountInfo(proposal),
      ).resolves.toEqual([
        {
          impl: 'evm',
          accountSelectorNum: 1000,
          networkIds: ['evm--1'],
        },
      ]);
    },
  );

  it.each(inheritedNamespaceKeys)(
    'rejects inherited required namespace %s',
    async (namespace) => {
      const proposal = createProposal(
        {},
        {
          eip155: evmNamespace,
          [namespace]: { chains: [`${namespace}:1`], methods: [], events: [] },
        },
      );

      await expect(
        service.getSessionApprovalAccountInfo(proposal),
      ).rejects.toThrow('Namespace not supported');
    },
  );

  it.each<{ events: string[] }>([
    { events: [] },
    { events: ['accountsChanged', 'chainChanged'] },
  ])(
    'omits unsupported optional Solana with events $events',
    async ({ events }) => {
      const proposal = createProposal({
        eip155: evmNamespace,
        solana: {
          chains: [solanaChain],
          methods: ['solana_signTransaction'],
          events,
        },
      });

      const namespaces = await service.buildWalletConnectNamespace({
        proposal,
        accountsInfo: [evmAccount],
      });

      expect(Object.keys(namespaces)).toEqual(['eip155']);
      expect(namespaces.eip155).toMatchObject({
        chains: ['eip155:1'],
        accounts: [`eip155:1:${evmAccount.address}`],
      });
      expect(isValidNamespaces(namespaces, 'approve()')).toBeNull();
    },
  );

  it('merges supported required and optional EVM chains', async () => {
    const proposal = createProposal(
      {
        eip155: { ...evmNamespace, chains: ['eip155:1', 'eip155:8453'] },
        solana: { chains: [solanaChain], methods: [], events: [] },
      },
      { eip155: evmNamespace },
    );

    const namespaces = await service.buildWalletConnectNamespace({
      proposal,
      accountsInfo: [evmAccount],
    });

    expect(Object.keys(namespaces)).toEqual(['eip155']);
    expect(namespaces.eip155).toMatchObject({
      chains: ['eip155:1', 'eip155:8453'],
      accounts: [
        `eip155:1:${evmAccount.address}`,
        `eip155:8453:${evmAccount.address}`,
      ],
    });
    expect(isValidNamespaces(namespaces, 'approve()')).toBeNull();
    expect(
      isConformingNamespaces(
        proposal.params.requiredNamespaces,
        namespaces,
        'approve()',
      ),
    ).toBeNull();
  });

  it.each([false, true])(
    'omits optional Algorand when every chain is unsupported (account selected: %s)',
    async (accountSelected) => {
      const proposal = createProposal(
        { algorand: { ...algoNamespace, chains: [unsupportedAlgoChain] } },
        { eip155: evmNamespace },
      );

      expect(
        isValidRequiredNamespaces(
          proposal.params.optionalNamespaces,
          'proposal()',
          'optionalNamespaces',
        ),
      ).toBeNull();

      const namespaces = await service.buildWalletConnectNamespace({
        proposal,
        accountsInfo: accountSelected
          ? [evmAccount, algoAccount]
          : [evmAccount],
      });

      expect(Object.keys(namespaces)).toEqual(['eip155']);
      expect(isValidNamespaces(namespaces, 'approve()')).toBeNull();
      expect(
        isConformingNamespaces(
          proposal.params.requiredNamespaces,
          namespaces,
          'approve()',
        ),
      ).toBeNull();
    },
  );

  it('does not offer an optional account selector without supported networks', async () => {
    const proposal = createProposal(
      { algorand: { ...algoNamespace, chains: [unsupportedAlgoChain] } },
      { eip155: evmNamespace },
    );

    await expect(
      service.getSessionApprovalAccountInfo(proposal),
    ).resolves.toEqual([
      { impl: 'evm', accountSelectorNum: 1000, networkIds: ['evm--1'] },
    ]);
  });

  it.each([
    { name: 'missing', accountsInfo: [evmAccount] },
    {
      name: 'empty address',
      accountsInfo: [evmAccount, { ...algoAccount, address: '' }],
    },
  ])(
    'omits optional Algorand without a usable account ($name)',
    async ({ accountsInfo }) => {
      const proposal = createProposal(
        { algorand: algoNamespace },
        { eip155: evmNamespace },
      );

      const namespaces = await service.buildWalletConnectNamespace({
        proposal,
        accountsInfo,
      });

      expect(Object.keys(namespaces)).toEqual(['eip155']);
      expect(isValidNamespaces(namespaces, 'approve()')).toBeNull();
    },
  );

  it('preserves supported optional chains when other chains are unsupported', async () => {
    const proposal = createProposal(
      {
        algorand: {
          ...algoNamespace,
          chains: [unsupportedAlgoChain, algoChain],
        },
      },
      { eip155: evmNamespace },
    );

    await expect(
      service.getSessionApprovalAccountInfo(proposal),
    ).resolves.toEqual([
      { impl: 'evm', accountSelectorNum: 1000, networkIds: ['evm--1'] },
      { impl: 'algo', accountSelectorNum: 1001, networkIds: ['algo--4160'] },
    ]);

    const namespaces = await service.buildWalletConnectNamespace({
      proposal,
      accountsInfo: [evmAccount, algoAccount],
    });

    expect(Object.keys(namespaces)).toEqual(['eip155', 'algorand']);
    expect(namespaces.algorand).toMatchObject({
      chains: [algoChain],
      accounts: [`${algoChain}:${algoAccount.address}`],
    });
    expect(isValidNamespaces(namespaces, 'approve()')).toBeNull();
  });

  it.each([false, true])(
    'preserves optional Algorand (EVM required: %s)',
    async (requiredEvm) => {
      const proposal = createProposal(
        {
          ...(requiredEvm ? {} : { eip155: evmNamespace }),
          algorand: algoNamespace,
        },
        requiredEvm ? { eip155: evmNamespace } : {},
      );

      const namespaces = await service.buildWalletConnectNamespace({
        proposal,
        accountsInfo: [evmAccount, algoAccount],
      });

      expect(Object.keys(namespaces)).toEqual(['eip155', 'algorand']);
      expect(namespaces.algorand).toMatchObject({
        chains: [algoChain],
        accounts: [`${algoChain}:${algoAccount.address}`],
      });
      expect(isValidNamespaces(namespaces, 'approve()')).toBeNull();
      expect(
        isConformingNamespaces(
          proposal.params.requiredNamespaces,
          namespaces,
          'approve()',
        ),
      ).toBeNull();
    },
  );
});
