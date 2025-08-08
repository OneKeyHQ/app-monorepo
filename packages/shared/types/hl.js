/* eslint-disable no-var */
/* eslint-disable vars-on-top */
/* eslint-disable no-unused-expressions */
/* eslint-disable no-unreachable */
/* eslint-disable no-sequences */
/* eslint-disable no-array-constructor */
/* eslint-disable prefer-const */
/* eslint-disable no-cond-assign */
/* eslint-disable no-nested-ternary */
const a = (e, t, n) => {
  n.d(t, {
    AS: () => u,
    Lt: () => g,
    PH: () => c,
    WQ: () => m,
    dN: () => h,
    gO: () => y,
    lX: () => d,
    lm: () => p,
    sl: () => f,
  });
  n(47_313);
  const r = n(36_714); // zzzz 36714:  r.Yw
  const i = n(71_325);
  const o = n(40_139);
  const a = n(46_417);
  function s(e) {
    return {
      a: e.asset,
      b: e.isBuy,
      p: e.limitPx,
      s: e.sz,
      r: e.reduceOnly,
      t: e.orderType,
    };
  }
  function l(e) {
    return {
      a: e.asset,
      b: e.isBuy,
      s: d(e.sz),
      r: e.reduceOnly,
      m: e.minutes,
      t: e.randomize,
    };
  }
  const c = 0.08;
  function u(e, t, n, i, o) {
    const { floatSide: a } = (0, r.cc)(t);
    let s = i !== null && void 0 !== i ? i : c;
    t || (s = Math.min(s, 0.7));
    const l = e * (1 + a * s);
    return (0, r.xN)(l, n, o, 'floor');
  }
  function d(e) {
    let t = (0, r.rF)(e);
    return t.endsWith('.0') && (t = t.slice(0, -2)), t;
  }
  const h = (e) => {
    let t;
    const {
      activeCoin: n,
      orderSender: i,
      userLimitPx: a,
      userStopPx: s,
      userTpPx: l,
      mids: c,
      isBuyOrder: h,
      userSz: p,
      isReduceOnly: f,
      tif: g,
      positionTpsl: m,
      childSlPx: y,
      childTpPx: v,
      childSlLimitPx: b,
      childTpLimitPx: w,
      universe: C,
      spotMeta: x,
      maxSlippage: S,
    } = e;
    if (s && l)
      return void console.error('userStopPx and userTpPx cannot both exist');
    const A = c[n];
    if (void 0 === A && a === null)
      return void console.error('Mid and userLimitPx are undefined');
    const k = (0, r.RG)(n, C);
    const E = (0, r.sE)(n, C, x);
    if (E === null) return void console.error('szDecimals is null', C, k, E);
    const I = (0, o.a6)(n);
    const T = (e, t, n) => {
      if ((0, r.Rw)(i))
        return void console.error(
          'maybePushChildOrder missing orderSender, BUG',
        );
      if ((0, r.Rw)(e)) return;
      console.log('sending order', e);
      const o = {
        asset: k,
        isBuyOrder: R,
        sz: d(p),
        limitPx: d((0, r.Rw)(t) ? u(e, R, E, null, I) : t),
        triggerPx: d(e),
        orderSender: i,
        isReduceOnly: !0,
      };
      N.push({
        decodedOrder: o,
        orderType: n,
      });
    };
    if ((0, r.Rw)(i))
      return void console.error('orderRequest missing orderSender');
    let j;
    if (a) j = a;
    else if (s) j = u(s, h, E, null, I);
    else if (l) j = u(l, h, E, null, I);
    else {
      if (!A)
        return void console.error(
          'Limit px was not set because Mid is undefined and all of userLimitPx, userStopPx and userTpPx are undefined',
          a,
          s,
          l,
        );
      j = u(A, h, E, S, I);
    }
    const P = d(j);
    const _ = d(
      (t = s !== null && void 0 !== s ? s : l) !== null && void 0 !== t ? t : 0,
    );
    const O = {
      asset: k,
      isBuyOrder: h,
      sz: d(p),
      limitPx: P,
      triggerPx: _,
      orderSender: i,
      isReduceOnly: f,
    };
    let M;
    M = s
      ? {
          trigger: {
            isMarket: (0, r.Rw)(a),
            triggerPx: d(s),
            tpsl: 'sl',
          },
        }
      : l
      ? {
          trigger: {
            isMarket: (0, r.Rw)(a),
            triggerPx: d(l),
            tpsl: 'tp',
          },
        }
      : {
          limit: {
            tif: g,
          },
        };
    const N = Array();
    m ||
      N.push({
        decodedOrder: O,
        orderType: M,
      });
    const R = !h;
    return (
      T(y, b, {
        trigger: {
          isMarket: (0, r.Rw)(b),
          triggerPx: d(y !== null && void 0 !== y ? y : 0),
          tpsl: 'sl',
        },
      }),
      T(v, w, {
        trigger: {
          isMarket: (0, r.Rw)(w),
          triggerPx: d(v !== null && void 0 !== v ? v : 0),
          tpsl: 'tp',
        },
      }),
      {
        orderSpecs: N,
        coin: n,
      }
    );
  };
  const p = async (e) => {
    let t;
    const {
      agentWallet: n,
      oid: o,
      orderSpec: l,
      orderSender: c,
      onFailureToModify: u,
      activeAccount: d,
    } = e;
    if ((0, r.Rw)(c))
      return (
        console.log('Unable to modify order because orderSender is null', c),
        (0, r.E)(
          (0, a.jsx)(i.Z, {
            id: 'must.enable.trading',
          }),
          'error',
        ),
        void u()
      );
    const {
      decodedOrder: {
        asset: h,
        isBuyOrder: p,
        sz: f,
        limitPx: g,
        isReduceOnly: m,
      },
      orderType: y,
    } = l;
    const v = {
      type: 'modify',
      oid: o,
      order: s({
        asset: h,
        isBuy: p,
        limitPx: g,
        sz: f,
        reduceOnly: m,
        orderType: y,
      }),
    };
    console.log(
      'sending modifyAction',
      v,
      (t = n.wallet) === null || void 0 === t ? void 0 : t.address,
    );
    const b = (0, r.E)(
      (0, a.jsx)(i.Z, {
        id: 'modify.request.submitted',
      }),
      'loading',
    );
    const w = await (0, r.Yw)(v, n, d);
    if ('error' in w)
      return (
        u(),
        void (0, r.E)(
          (0, a.jsx)(i.Z, {
            id: 'unexpected.error.modifying.order',
          }),
          'error',
          b,
        )
      );
    const C = w.response;
    if (C.status === 'err') return u(), void (0, r.E)(C.response, 'error', b);
    (0, r.E)(
      (0, a.jsx)(i.Z, {
        id: 'modified.order',
      }),
      'success',
      b,
    );
  };
  const f = async (e) => {
    const {
      agentWallet: t,
      orders: n,
      userAddress: o,
      universe: s,
      activeAccount: l,
    } = e;
    if (!o) return console.log('Not canceling because no address'), !1;
    const c = n.map((e) => {
      return {
        a: (t = {
          asset: (0, r.RG)(e.coin, s),
          oid: e.oid,
        }).asset,
        o: t.oid,
      };
      let t;
    });
    let u = !0;
    let d = 0;
    const h = (0, r.E)(
      (0, a.jsx)(i.Z, {
        id: 'canceling',
      }),
      'loading',
    );
    for (let p = 0; p < c.length; p += 100) {
      const e = {
        type: 'cancel',
        cancels: c.slice(p, p + 100),
      };
      const n = await (0, r.Yw)(e, t, l);
      if ('error' in n)
        return (
          (0, r.E)(
            (0, a.jsx)(i.Z, {
              id: 'unexpected.error.canceling.order',
            }),
            'error',
            h,
          ),
          !1
        );
      const o = n.response;
      if (o.status === 'err') return (0, r.E)(o.response, 'error', h), !1;
      const {
        data: { statuses: s },
      } = o.response;
      for (const t of s) t === 'success' ? (d += 1) : (u = !1);
    }
    return (
      c.length > 1
        ? d === c.length
          ? (0, r.E)(
              (0, a.jsx)(i.Z, {
                id: 'canceled.all.orders',
              }),
              'success',
              h,
            )
          : d > 0
          ? ((0, r.E)(
              (0, a.jsx)(i.Z, {
                id: 'canceled.count.orders',
                values: {
                  successCount: d,
                  len: c.length,
                },
              }),
              'success',
              h,
            ),
            (0, r.E)(
              (0, a.jsx)(i.Z, {
                id: 'something.wrong.canceling.order',
                values: {
                  len: c.length - d,
                },
              }),
              'error',
            ))
          : (0, r.E)(
              (0, a.jsx)(i.Z, {
                id: 'failed.to.cancel.all.orders',
              }),
              'error',
              h,
            )
        : c.length === 1 &&
          (d === 1
            ? (0, r.E)(
                (0, a.jsx)(i.Z, {
                  id: 'canceled.order',
                }),
                'success',
                h,
              )
            : (0, r.E)(
                (0, a.jsx)(i.Z, {
                  id: 'something.wrong.canceling.order.2',
                }),
                'error',
                h,
              )),
      u
    );
  };
  async function g(e, t, n, o) {
    let s;
    const l = {
      type: 'twapCancel',
      a: t,
      t: e,
    };
    console.log(
      'sending twapCancel action',
      l,
      (s = n.wallet) === null || void 0 === s ? void 0 : s.address,
    );
    const c = (0, r.E)(
      (0, a.jsx)(i.Z, {
        id: 'terminating.twap',
      }),
      'loading',
    );
    const u = await (0, r.Yw)(l, n, o);
    if ('error' in u)
      return void (0, r.E)(
        (0, a.jsx)(i.Z, {
          id: 'unexpected.error.sending.twap.terminate',
        }),
        'error',
        c,
      );
    const d = u.response;
    d.status !== 'err'
      ? d.status === 'ok' &&
        (0, r.E)(
          (0, a.jsx)(i.Z, {
            id: 'twap.terminated',
          }),
          'success',
          c,
        )
      : (0, r.E)(d.response, 'error', c);
  }
  async function m(e, t, n) {
    let o;
    const s = {
      type: 'twapOrder',
      twap: l(e),
    };
    console.log(
      'sending twapOrder request',
      s,
      (o = t.wallet) === null || void 0 === o ? void 0 : o.address,
    );
    const c = (0, r.E)(
      (0, a.jsx)(i.Z, {
        id: 'twap.order.submitted',
      }),
      'loading',
    );
    try {
      const e = await (0, r.Yw)(s, t, n);
      if ('error' in e)
        return void (0, r.E)(
          (0, a.jsx)(i.Z, {
            id: 'unexpected.error.sending.twap.order',
          }),
          'error',
          c,
        );
      const o = e.response;
      if (o.status === 'ok')
        if ('error' in o.response.data.status) {
          const e = o.response.data.status.error;
          (0, r.E)(e, 'error', c);
        } else
          (0, r.E)(
            (0, a.jsx)(i.Z, {
              id: 'twap.order.sent',
            }),
            'success',
            c,
          );
      else (0, r.E)(o.response, 'error', c);
    } catch (u) {
      console.error('Error sending TWAP order:', u),
        (0, r.E)(
          (0, a.jsx)(i.Z, {
            id: 'unexpected.error.sending.twap.order',
          }),
          'error',
          c,
        );
    }
  }
  const y = async (e) => {
    const {
      orderSpecs: t,
      agentWallet: n,
      orderSender: o,
      clearTextFields: l,
      coin: c,
      grouping: u,
      activeAccount: d,
      spotMeta: h,
      builder: p, // zzzz
    } = e;
    if (void 0 === t[0] || (0, r.Rw)(o))
      return void console.error(
        'Unable to send order because missing orderSpecs or orderSender is null',
        t,
        o,
      );
    const {
      decodedOrder: { isBuyOrder: f },
      orderType: g,
    } = t[0];
    const m = t.map((e) => {
      const {
        decodedOrder: {
          asset: t,
          isBuyOrder: n,
          sz: r,
          limitPx: i,
          isReduceOnly: o,
        },
        orderType: a,
      } = e;
      return s({
        asset: t,
        isBuy: n,
        limitPx: i,
        sz: r,
        reduceOnly: o,
        orderType: a,
      });
    });
    const y = (0, r.s9)();
    const v = (0, r.E)(
      (0, a.jsx)(i.Z, {
        id: 'order.submitted',
      }),
      'loading',
    );
    const b = [];
    for (let s = 0; s < m.length; s += 50) {
      var w;
      const e = m.slice(s, s + 50);
      const t =
        void 0 === p
          ? {
              type: 'order',
              orders: e,
              grouping: u,
            }
          : {
              type: 'order',
              orders: e,
              grouping: u,
              builder: p, // zzzz
            };
      console.log(
        'sending orderRequest',
        t,
        (w = n.wallet) === null || void 0 === w ? void 0 : w.address,
      );
      const o = await (0, r.Yw)(t, n, d); // zzzz
      if ('error' in o)
        return void (0, r.E)(
          (0, a.jsx)(i.Z, {
            id: 'unexpected.error.sending.order',
          }),
          'error',
          v,
        );
      const l = o.response;
      if (l.status === 'err') return void (0, r.E)(l.response, 'error', v);
      console.log('order_response', o, (0, r.s9)() - y);
      const {
        data: { statuses: C },
      } = l.response;
      for (const n of C)
        if (typeof n === 'object')
          if ('filled' in n) {
            const { avgPx: e, totalSz: t } = n.filled;
            const { base: o, quote: s } = (0, r.MW)(c, h);
            b.push(
              (0, a.jsx)(i.Z, {
                id: 'bought.or.sold.at.average.price',
                values: {
                  totalSz: t,
                  coin: o,
                  action: f
                    ? (0, a.jsx)(i.Z, {
                        id: 'bought',
                      })
                    : (0, a.jsx)(i.Z, {
                        id: 'sold',
                      }),
                  avgPxValue: ''.concat(s === 'USD' ? '$' : '').concat(e),
                },
              }),
            );
          } else
            'resting' in n
              ? 'trigger' in g
                ? b.push(
                    g.trigger.isMarket
                      ? 'Stop market order placed.'
                      : 'Stop limit order placed.',
                  )
                : b.push('Limit order placed.')
              : (0, r.E)(n.error, 'error', v);
        else
          n === 'waitingForTrigger'
            ? b.push('TP/SL order placed, waiting to trigger.')
            : n === 'waitingForFill' &&
              b.push('TP/SL order placed, waiting for fill trigger.');
    }
    void 0 !== b[0] &&
      ((0, r.j)('Sending Order Succeeded', o),
      l && l(),
      (0, r.E)(b[0], 'success', v));
  };
};

const a32113 = (e, t, n) => {
  n.d(t, {
    Z: () => x,
  });
  var r = n(36_714);
  var i = n(47_313);
  var o = n(60_253);
  var a = n(62_327);
  var s = n(26_608);
  var l = n(14_045); // zzzz 14045:  y6
  var c = n(92_433);
  var u = n(76_657);
  var d = n(94_139);
  var h = n(76_627);
  var p = n(327);
  var f = n(97_943);
  var g = n(28_081);
  var m = n(936);
  var y = n(71_325);
  var v = n(6776);
  var b = n(17_823);
  var w = n(82_060);
  var C = n(46_417);
  const x = (e) => {
    let {
      userSz: t,
      activeCoin: n,
      disabled: x,
      isBuyOrder: S,
      isReduceOnly: A,
      buttonSize: k,
      variant: E,
      text: I,
      clearTextFields: T,
      userLimitPx: j,
      userStopPx: P,
      tif: _,
      childTpPx: O,
      childSlPx: M,
      childTpLimitPx: N,
      childSlLimitPx: R,
      positionTpsl: L,
      onClose: D,
      preSubmitValidation: B,
      forceSkipConfirmation: U,
      grouping: z,
      traderState: F,
      scaleOrder: Z,
      twapOrder: H,
      maxSlippage: W,
    } = e;
    const q = (0, m.Z)();
    const {
      universe: V,
      activeAccount: G,
      spotMeta: K,
      perpsAtOICap: Y,
    } = (0, b.jg)();
    const { activeAssetData: X } = (0, h.j9)();
    const { mids: J } = (0, c.Cz)();
    const Q = (0, l.Fu)();
    const { [l.GA]: $, [l.y6]: ee, setGlobalValue: te } = Q;
    const { agentWrapper: ne } = (0, u.kh)();
    const { agentWallet: re } = ne;
    const { isMobileOrTablet: ie } = (0, d.eI)();
    const [oe, ae] = (0, i.useState)(() => {});
    const [se, le] = (0, i.useState)(!1);
    const [ce, ue] = (0, i.useState)(!1);
    const { address: de } = (0, r.mV)();
    const { bbo: he } = (0, w.CQ)();
    const pe = !!Z;
    const fe = !!H;
    const ge = (0, r.RG)(n, V);
    const me = (0, r.sE)(n, V, K);
    if (me === null || void 0 === de)
      return (
        console.error(
          'Not rendering trade button because unable to get szDecimals or orderSender',
          n,
          V,
          de,
        ),
        null
      );
    const ye = (() => {
      if (_ === 'Alo') return !1;
      const { side: e } = (0, r.cc)(S);
      if (pe) {
        var t;
        var n;
        var i;
        var o;
        const a =
          (t = (n = Z[0]) === null || void 0 === n ? void 0 : n.px) !== null &&
          void 0 !== t
            ? t
            : 0;
        const s =
          (i =
            (o = Z[Z.length - 1]) === null || void 0 === o ? void 0 : o.px) !==
            null && void 0 !== i
            ? i
            : 0;
        return (0, r.gI)(a, 0.03, e, he) || (0, r.gI)(s, 0.03, e, he);
      }
      return (
        !fe &&
        (P
          ? (0, r.gI)(j, 0.03, e, {
              ask: P,
              bid: P,
            })
          : (0, r.gI)(j, 0.03, e, he))
      );
    })();
    const ve = async (e, t) => {
      if (e) await (0, o.WQ)(e, re, G);
      else if (t) {
        let e;
        void 0 !== ee &&
          (e = {
            // zzzz
            b: ee.builderAddress.toLowerCase(),
            f: 1e5 * ee.feeRate,
          }),
          await (0, o.gO)({
            orderSpecs: t,
            agentWallet: re,
            orderSender: de,
            clearTextFields: T,
            coin: n,
            grouping: z,
            activeAccount: G,
            spotMeta: K,
            builder: e,
          });
      }
    };
    const be = async () => {
      var e;
      if (j && Y.includes(n))
        return void (0, r.E)(
          (0, C.jsx)(y.Z, {
            id: 'limit.order.open.interest.cap.error',
          }),
          'error',
        );
      const i = pe
        ? (0, f.EY)(ge, S, A, Z, de, _)
        : (e = (0, o.dN)({
            activeCoin: n,
            orderSender: de,
            userLimitPx: j,
            userStopPx: P,
            mids: J,
            isBuyOrder: S,
            universe: V,
            spotMeta: K,
            userSz: t,
            isReduceOnly: A,
            tif: _,
            positionTpsl: L,
            childSlPx: M,
            childTpPx: O,
            childSlLimitPx: R,
            childTpLimitPx: N,
            maxSlippage: W,
          })) === null || void 0 === e
        ? void 0
        : e.orderSpecs;
      if (void 0 !== i || void 0 !== H) {
        if (
          (pe &&
            (0, r.j)('Place Scale Order Clicked', de, {
              skipOpenOrderConfirmation: $,
            }),
          B && !B())
        )
          return console.log('trade button failed validation'), void ue(!1);
        ($ && !ye) || U
          ? await ve(H, i)
          : (ae(() => () => {
              ve(H, i), ae(() => {});
            }),
            ue(!0)),
          D && D();
      } else
        (0, r.E)(
          q.formatMessage({
            id: 'something.wrong.with.order',
          }),
          'error',
        );
    };
    const we = E === 'link';
    let Ce;
    Ce = we
      ? (0, C.jsx)(s.rU, {
          onClick: be,
          children: I,
        })
      : (0, C.jsx)(s.zx, {
          block: !0,
          color: S || E === 'primary' ? 'primary' : 'red',
          disabled: x || se,
          onClick: async () => {
            le(!0), await be(), le(!1);
          },
          size: k,
          children: I,
        });
    const xe = {
      activeCoin: n,
      isBuyOrder: S,
      userSz: t.toFixed(me),
      sendOrderCallback: oe,
      skipConfirmation: $,
      setSkipConfirmation: (e) => te(l.GA, e),
      isMobileOrTablet: ie,
      setShowModal: ue,
    };
    return (0, C.jsxs)(C.Fragment, {
      children: [
        (0, C.jsx)(a.Z, {
          textConnection: we,
          block: !we,
          traderState: F,
          buttonSize: k,
          children: Ce,
        }),
        ce &&
          (() => {
            var e;
            return pe
              ? (0, C.jsx)(g.Z, {
                  scaleOrder: Z,
                  confirmationModalProps: xe,
                  limitPxIsTooAggressive: ye,
                })
              : fe
              ? (0, C.jsx)(v.Z, {
                  twapOrder: H,
                  confirmationModalProps: xe,
                })
              : (0, C.jsx)(p.Z, {
                  userLimitPx: j,
                  leverage:
                    (e = X === null || void 0 === X ? void 0 : X.leverage) !==
                      null && void 0 !== e
                      ? e
                      : null,
                  isReduceOnly: A,
                  confirmationModalProps: xe,
                  limitPxIsTooAggressive: ye,
                });
          })(),
      ],
    });
  };
};
