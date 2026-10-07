/** @jest-environment jsdom */

import type { ReactElement } from 'react';

import { MarketHoverRevealLine } from './MarketHoverRevealLine';
import {
  MarketTokenAgeAddressLine,
  TokenContractAddressLine,
} from './MarketTokenAgeAddressLine';

// The line has no hooks of its own, so it can be expanded as a plain function
// and its element shape inspected without a renderer.
describe('MarketTokenAgeAddressLine', () => {
  test('slides the address in over the age when both are present', () => {
    const element = MarketTokenAgeAddressLine({
      address: '0xabc',
      ageLabel: '2M',
    }) as ReactElement<{
      resting: ReactElement;
      revealed: ReactElement<{ address: string }>;
    }>;

    expect(element.type).toBe(MarketHoverRevealLine);
    expect(element.props.revealed.type).toBe(TokenContractAddressLine);
    expect(element.props.revealed.props.address).toBe('0xabc');
  });

  test('shows the address alone when there is no age', () => {
    const element = MarketTokenAgeAddressLine({
      address: '0xabc',
    }) as ReactElement;

    expect(element.type).toBe(TokenContractAddressLine);
  });

  test('shows the age line alone when there is no address', () => {
    const element = MarketTokenAgeAddressLine({
      address: '',
      ageLabel: '2M',
    }) as ReactElement;

    expect(element.type).not.toBe(MarketHoverRevealLine);
    expect(element.type).not.toBe(TokenContractAddressLine);
  });
});
