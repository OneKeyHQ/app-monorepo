import {
  getSectionListItemStartOffset,
  getSectionListScrollToLocationItemIndex,
  getSectionListSelectedItemLocation,
  getSectionListSelectedItemScrollOffset,
  getSectionListSelectedItemViewOffset,
} from './sectionListScroll';

describe('sectionListScroll', () => {
  const sections = [
    {
      title: 'A',
      data: [{ id: 'a1' }, { id: 'a2' }],
    },
    {
      title: 'B',
      data: [{ id: 'b1' }, { id: 'b2' }, { id: 'b3' }],
    },
    {
      title: 'S',
      data: [{ id: 's1' }, { id: 's2' }],
    },
  ];

  it('finds the first two items in a later section by section and item index', () => {
    expect(
      getSectionListSelectedItemLocation({
        sections,
        selectedId: 'b1',
      }),
    ).toEqual({ sectionIndex: 1, itemIndex: 0 });
    expect(
      getSectionListSelectedItemLocation({
        sections,
        selectedId: 'b2',
      }),
    ).toEqual({ sectionIndex: 1, itemIndex: 1 });
  });

  it('finds later section items', () => {
    expect(
      getSectionListSelectedItemLocation({
        sections,
        selectedId: 'b3',
      }),
    ).toEqual({ sectionIndex: 1, itemIndex: 2 });
  });

  it('finds the first section first item', () => {
    expect(
      getSectionListSelectedItemLocation({
        sections,
        selectedId: 'a1',
      }),
    ).toEqual({ sectionIndex: 0, itemIndex: 0 });
  });

  it('returns undefined when the selected item is missing', () => {
    expect(
      getSectionListSelectedItemLocation({
        sections,
        selectedId: 'missing',
      }),
    ).toBeUndefined();
  });

  it('converts a data item index to SectionList scrollToLocation itemIndex', () => {
    expect(getSectionListScrollToLocationItemIndex({ itemIndex: 0 })).toBe(1);
    expect(getSectionListScrollToLocationItemIndex({ itemIndex: 2 })).toBe(3);
  });

  it('keeps space above the selected item for sticky section headers', () => {
    expect(getSectionListSelectedItemViewOffset({ rowHeight: 48 })).toBe(96);
  });

  it('calculates exact item offsets with section headers and separators', () => {
    expect(
      getSectionListItemStartOffset({
        sections,
        sectionIndex: 1,
        itemIndex: 0,
        rowHeight: 48,
      }),
    ).toBe(188);
    expect(
      getSectionListItemStartOffset({
        sections,
        sectionIndex: 1,
        itemIndex: 1,
        rowHeight: 48,
      }),
    ).toBe(236);
  });

  it('does not count a header for untitled sections', () => {
    expect(
      getSectionListItemStartOffset({
        sections: [
          {
            data: [{ id: 'recent' }],
          },
          {
            title: 'S',
            data: [{ id: 's1' }],
          },
        ],
        sectionIndex: 1,
        itemIndex: 0,
        rowHeight: 48,
      }),
    ).toBe(104);
  });

  it('returns a clamped scroll offset that leaves rows above the selection', () => {
    expect(
      getSectionListSelectedItemScrollOffset({
        sections,
        sectionIndex: 2,
        itemIndex: 0,
        rowHeight: 48,
      }),
    ).toBe(292);
    expect(
      getSectionListSelectedItemScrollOffset({
        sections,
        sectionIndex: 0,
        itemIndex: 0,
        rowHeight: 48,
      }),
    ).toBe(0);
  });

  it('includes a list header height in selected item offsets', () => {
    expect(
      getSectionListSelectedItemScrollOffset({
        sections,
        sectionIndex: 1,
        itemIndex: 0,
        rowHeight: 48,
        listHeaderHeight: 44,
      }),
    ).toBe(136);
  });
});
