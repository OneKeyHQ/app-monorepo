import { useMemo, useRef } from 'react';

export type IHasId = { uuid: string };
export type ILinkedListOptions = { circular?: boolean };

type ILinkedNode<T extends IHasId> = {
  uuid: string;
  data: T;
  prev?: ILinkedNode<T>;
  next?: ILinkedNode<T>;
};

export class LinkedDeck<T extends IHasId> {
  private nodes = new Map<string, ILinkedNode<T>>();

  private _head?: ILinkedNode<T>;

  private _tail?: ILinkedNode<T>;

  private _current?: ILinkedNode<T>;

  private _circular = false;

  private listeners = new Set<() => void>();

  private _version = 0;

  size = 0;

  constructor(items: T[] = [], options: ILinkedListOptions = {}) {
    this._circular = !!options.circular;
    this.reset(items);
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private emit() {
    this._version += 1;
    this.listeners.forEach((l) => l());
  }

  get version() {
    return this._version;
  }

  get circular() {
    return this._circular;
  }

  set circular(v: boolean) {
    this._circular = !!v;
    this.emit();
  }

  reset(items: T[] = []) {
    this.nodes.clear();
    this._head = undefined;
    this._tail = undefined;
    this._current = undefined;
    this.size = 0;

    let prev: ILinkedNode<T> | undefined;
    for (const it of items) {
      const n: ILinkedNode<T> = {
        uuid: it.uuid,
        data: it,
        prev,
        next: undefined,
      };
      this.nodes.set(n.uuid, n);
      if (!this._head) this._head = n;
      if (prev) prev.next = n;
      prev = n;
      this.size += 1;
    }
    this._tail = prev;
    this._current = this._head;
    this.emit();
  }

  get current(): T | undefined {
    return this._current?.data;
  }

  get head(): T | undefined {
    return this._head?.data;
  }

  get tail(): T | undefined {
    return this._tail?.data;
  }

  get currentIndex(): number {
    let i = 0;
    let p = this._head;
    while (p) {
      if (p === this._current) return i;
      p = p.next;
      i += 1;
    }
    return -1;
  }

  next(): T | undefined {
    if (!this._current) return undefined;
    if (this._current.next) this._current = this._current.next;
    else if (this._circular && this._head) this._current = this._head;
    this.emit();
    return this._current?.data;
  }

  prev(): T | undefined {
    if (!this._current) return undefined;
    if (this._current.prev) this._current = this._current.prev;
    else if (this._circular && this._tail) this._current = this._tail;
    this.emit();
    return this._current?.data;
  }

  jumpTo(id: string): T | undefined {
    const n = this.nodes.get(id);
    if (!n) return this._current?.data;
    this._current = n;
    this.emit();
    return n.data;
  }

  jumpToIndex(index: number): T | undefined {
    if (this.size === 0) return undefined;
    let i = index;
    if (this._circular) {
      i = ((index % this.size) + this.size) % this.size;
    }
    if (!this._circular) {
      if (index < 0) {
        i = 0;
      } else if (index >= this.size) {
        i = this.size - 1;
      } else {
        i = index;
      }
    }

    let p = this._head!;
    for (let k = 0; k < i; k += 1) p = p.next!;
    this._current = p;
    this.emit();
    return p.data;
  }

  remove(id: string): void {
    const n = this.nodes.get(id);
    if (!n) return;
    if (n.prev) n.prev.next = n.next;
    else this._head = n.next;
    if (n.next) n.next.prev = n.prev;
    else this._tail = n.prev;
    if (this._current === n) this._current = n.next ?? n.prev;
    this.nodes.delete(id);
    this.size -= 1;
    this.emit();
  }

  removeCurrent(): T | undefined {
    const uuid = this._current?.uuid;
    if (!uuid) return undefined;
    this.remove(uuid);
    return this._current?.data;
  }

  append(item: T): void {
    const node: ILinkedNode<T> = {
      uuid: item.uuid,
      data: item,
      prev: this._tail,
      next: undefined,
    };
    if (this._tail) this._tail.next = node;
    else this._head = node;
    this._tail = node;
    this.nodes.set(item.uuid, node);
    this.size += 1;
    if (!this._current) this._current = node;
    this.emit();
  }

  prepend(item: T): void {
    const node: ILinkedNode<T> = {
      uuid: item.uuid,
      data: item,
      prev: undefined,
      next: this._head,
    };
    if (this._head) this._head.prev = node;
    else this._tail = node;
    this._head = node;
    this.nodes.set(item.uuid, node);
    this.size += 1;
    if (!this._current) this._current = node;
    this.emit();
  }

  toArray(): T[] {
    const out: T[] = [];
    let p = this._head;
    while (p) {
      out.push(p.data);
      p = p.next;
    }
    return out;
  }
}

export function useLinkedList<T extends IHasId>(
  initial: T[] = [],
  options: ILinkedListOptions = {},
) {
  const deckRef = useRef<LinkedDeck<T> | null>(null);
  if (deckRef.current === null)
    deckRef.current = new LinkedDeck(initial, options);
  const deck = deckRef.current;

  return useMemo(
    () =>
      ({
        get size() {
          return deck.size;
        },
        get current() {
          return deck.current;
        },
        get head() {
          return deck.head;
        },
        get tail() {
          return deck.tail;
        },
        get currentIndex() {
          return deck.currentIndex;
        },
        get circular() {
          return deck.circular;
        },
        toArray: () => deck.toArray(),

        next: () => deck.next(),
        prev: () => deck.prev(),
        jumpTo: (id: string) => deck.jumpTo(id),
        jumpToIndex: (i: number) => deck.jumpToIndex(i),
        remove: (id: string) => deck.remove(id),
        removeCurrent: () => deck.removeCurrent(),
        append: (item: T) => deck.append(item),
        prepend: (item: T) => deck.prepend(item),
        reset: (items: T[] = []) => deck.reset(items),
        setCircular: (v: boolean) => {
          deck.circular = v;
        },
      } as const),
    [deck],
  );
}
