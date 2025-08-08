import { useCallback, useMemo, useRef, useState } from 'react';

export type IHasId = { id: string };

type ILinkedNode<T extends IHasId> = {
  id: string;
  data: T;
  prev?: ILinkedNode<T>;
  next?: ILinkedNode<T>;
};

class LinkedDeck<T extends IHasId> {
  private nodes = new Map<string, ILinkedNode<T>>();

  private _head?: ILinkedNode<T>;

  private _tail?: ILinkedNode<T>;

  private _current?: ILinkedNode<T>;

  size = 0;

  constructor(items: T[] = []) {
    this.reset(items);
  }

  reset(items: T[] = []) {
    this.nodes.clear();
    this._head = undefined;
    this._tail = undefined;
    this._current = undefined;
    this.size = 0;

    let prev: ILinkedNode<T> | undefined;
    for (const it of items) {
      const n: ILinkedNode<T> = { id: it.id, data: it, prev, next: undefined };
      this.nodes.set(it.id, n);
      if (!this._head) this._head = n;
      if (prev) prev.next = n;
      prev = n;
      this.size += 1;
    }
    this._tail = prev;
    this._current = this._head;
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

  next(): T | undefined {
    if (this._current?.next) this._current = this._current.next;
    return this._current?.data;
  }

  prev(): T | undefined {
    if (this._current?.prev) this._current = this._current.prev;
    return this._current?.data;
  }

  jumpTo(id: string): T | undefined {
    const n = this.nodes.get(id);
    if (!n) return this._current?.data;
    this._current = n;
    return n.data;
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
  }

  append(item: T): void {
    const node: ILinkedNode<T> = {
      id: item.id,
      data: item,
      prev: this._tail,
      next: undefined,
    };
    if (this._tail) this._tail.next = node;
    else this._head = node;
    this._tail = node;
    this.nodes.set(item.id, node);
    this.size += 1;
    if (!this._current) this._current = node;
  }

  prepend(item: T): void {
    const node: ILinkedNode<T> = {
      id: item.id,
      data: item,
      prev: undefined,
      next: this._head,
    };
    if (this._head) this._head.prev = node;
    else this._tail = node;
    this._head = node;
    this.nodes.set(item.id, node);
    this.size += 1;
    if (!this._current) this._current = node;
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

export function useLinkedList<T extends IHasId>(initial: T[] = []) {
  const deckRef = useRef<LinkedDeck<T> | null>(null);
  if (deckRef.current === null) deckRef.current = new LinkedDeck(initial);

  const [, setV] = useState(0);
  const bump = useCallback(() => setV((x) => x + 1), []);

  const api = useMemo(() => {
    const deck = deckRef.current as LinkedDeck<T>;
    return {
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
      toArray: () => deck.toArray(),

      next: () => {
        const r = deck.next();
        bump();
        return r;
      },
      prev: () => {
        const r = deck.prev();
        bump();
        return r;
      },
      jumpTo: (id: string) => {
        const r = deck.jumpTo(id);
        bump();
        return r;
      },
      remove: (id: string) => {
        deck.remove(id);
        bump();
      },
      removeCurrent: () => {
        const id = deck.current?.id;
        if (id) {
          deck.remove(id);
          bump();
        }
      },
      append: (item: T) => {
        deck.append(item);
        bump();
      },
      prepend: (item: T) => {
        deck.prepend(item);
        bump();
      },
      reset: (items: T[] = []) => {
        deck.reset(items);
        bump();
      },
    } as const;
  }, [bump]);

  return api;
}
