import { mergeItems } from './merge-items.js';

describe('mergeItems', () => {
  it('adds up quantities of repeated products and keeps first-seen order', () => {
    expect(
      mergeItems([
        { productId: 2, quantity: 1 },
        { productId: 1, quantity: 3 },
        { productId: 2, quantity: 4 },
      ]),
    ).toEqual([
      { productId: 2, quantity: 5 },
      { productId: 1, quantity: 3 },
    ]);
  });
});
