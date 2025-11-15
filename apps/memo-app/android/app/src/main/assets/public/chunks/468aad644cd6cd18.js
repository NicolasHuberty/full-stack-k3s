(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([
  "object" == typeof document ? document.currentScript : void 0,
  33525,
  (e, t, r) => {
    "use strict";
    Object.defineProperty(r, "__esModule", { value: !0 }),
      Object.defineProperty(r, "warnOnce", {
        enumerable: !0,
        get: function () {
          return n;
        },
      });
    let n = (e) => {};
  },
  98183,
  (e, t, r) => {
    "use strict";
    Object.defineProperty(r, "__esModule", { value: !0 });
    var n = {
      assign: function () {
        return l;
      },
      searchParamsToUrlQuery: function () {
        return i;
      },
      urlQueryToSearchParams: function () {
        return s;
      },
    };
    for (var a in n) Object.defineProperty(r, a, { enumerable: !0, get: n[a] });
    function i(e) {
      let t = {};
      for (let [r, n] of e.entries()) {
        let e = t[r];
        void 0 === e
          ? (t[r] = n)
          : Array.isArray(e)
            ? e.push(n)
            : (t[r] = [e, n]);
      }
      return t;
    }
    function o(e) {
      return "string" == typeof e
        ? e
        : ("number" != typeof e || isNaN(e)) && "boolean" != typeof e
          ? ""
          : String(e);
    }
    function s(e) {
      let t = new URLSearchParams();
      for (let [r, n] of Object.entries(e))
        if (Array.isArray(n)) for (let e of n) t.append(r, o(e));
        else t.set(r, o(n));
      return t;
    }
    function l(e, ...t) {
      for (let r of t) {
        for (let t of r.keys()) e.delete(t);
        for (let [t, n] of r.entries()) e.append(t, n);
      }
      return e;
    }
  },
  86762,
  (e, t, r) => {
    "use strict";
    Object.defineProperty(r, "__esModule", { value: !0 });
    var n = {
      formatUrl: function () {
        return s;
      },
      formatWithValidation: function () {
        return u;
      },
      urlObjectKeys: function () {
        return l;
      },
    };
    for (var a in n) Object.defineProperty(r, a, { enumerable: !0, get: n[a] });
    let i = e.r(90809)._(e.r(98183)),
      o = /https?|ftp|gopher|file/;
    function s(e) {
      let { auth: t, hostname: r } = e,
        n = e.protocol || "",
        a = e.pathname || "",
        s = e.hash || "",
        l = e.query || "",
        u = !1;
      (t = t ? encodeURIComponent(t).replace(/%3A/i, ":") + "@" : ""),
        e.host
          ? (u = t + e.host)
          : r &&
            ((u = t + (~r.indexOf(":") ? `[${r}]` : r)),
            e.port && (u += ":" + e.port)),
        l && "object" == typeof l && (l = String(i.urlQueryToSearchParams(l)));
      let c = e.search || (l && `?${l}`) || "";
      return (
        n && !n.endsWith(":") && (n += ":"),
        e.slashes || ((!n || o.test(n)) && !1 !== u)
          ? ((u = "//" + (u || "")), a && "/" !== a[0] && (a = "/" + a))
          : u || (u = ""),
        s && "#" !== s[0] && (s = "#" + s),
        c && "?" !== c[0] && (c = "?" + c),
        (a = a.replace(/[?#]/g, encodeURIComponent)),
        (c = c.replace("#", "%23")),
        `${n}${u}${a}${c}${s}`
      );
    }
    let l = [
      "auth",
      "hash",
      "host",
      "hostname",
      "href",
      "path",
      "pathname",
      "port",
      "protocol",
      "query",
      "search",
      "slashes",
    ];
    function u(e) {
      return s(e);
    }
  },
  18581,
  (e, t, r) => {
    "use strict";
    Object.defineProperty(r, "__esModule", { value: !0 }),
      Object.defineProperty(r, "useMergedRef", {
        enumerable: !0,
        get: function () {
          return a;
        },
      });
    let n = e.r(71645);
    function a(e, t) {
      let r = (0, n.useRef)(null),
        a = (0, n.useRef)(null);
      return (0, n.useCallback)(
        (n) => {
          if (null === n) {
            let e = r.current;
            e && ((r.current = null), e());
            let t = a.current;
            t && ((a.current = null), t());
          } else e && (r.current = i(e, n)), t && (a.current = i(t, n));
        },
        [e, t],
      );
    }
    function i(e, t) {
      if ("function" != typeof e)
        return (
          (e.current = t),
          () => {
            e.current = null;
          }
        );
      {
        let r = e(t);
        return "function" == typeof r ? r : () => e(null);
      }
    }
    ("function" == typeof r.default ||
      ("object" == typeof r.default && null !== r.default)) &&
      void 0 === r.default.__esModule &&
      (Object.defineProperty(r.default, "__esModule", { value: !0 }),
      Object.assign(r.default, r),
      (t.exports = r.default));
  },
  18967,
  (e, t, r) => {
    "use strict";
    Object.defineProperty(r, "__esModule", { value: !0 });
    var n = {
      DecodeError: function () {
        return y;
      },
      MiddlewareNotFoundError: function () {
        return j;
      },
      MissingStaticPage: function () {
        return b;
      },
      NormalizeError: function () {
        return v;
      },
      PageNotFoundError: function () {
        return x;
      },
      SP: function () {
        return m;
      },
      ST: function () {
        return g;
      },
      WEB_VITALS: function () {
        return i;
      },
      execOnce: function () {
        return o;
      },
      getDisplayName: function () {
        return d;
      },
      getLocationOrigin: function () {
        return u;
      },
      getURL: function () {
        return c;
      },
      isAbsoluteUrl: function () {
        return l;
      },
      isResSent: function () {
        return f;
      },
      loadGetInitialProps: function () {
        return h;
      },
      normalizeRepeatedSlashes: function () {
        return p;
      },
      stringifyError: function () {
        return w;
      },
    };
    for (var a in n) Object.defineProperty(r, a, { enumerable: !0, get: n[a] });
    let i = ["CLS", "FCP", "FID", "INP", "LCP", "TTFB"];
    function o(e) {
      let t,
        r = !1;
      return (...n) => (r || ((r = !0), (t = e(...n))), t);
    }
    let s = /^[a-zA-Z][a-zA-Z\d+\-.]*?:/,
      l = (e) => s.test(e);
    function u() {
      let { protocol: e, hostname: t, port: r } = window.location;
      return `${e}//${t}${r ? ":" + r : ""}`;
    }
    function c() {
      let { href: e } = window.location,
        t = u();
      return e.substring(t.length);
    }
    function d(e) {
      return "string" == typeof e ? e : e.displayName || e.name || "Unknown";
    }
    function f(e) {
      return e.finished || e.headersSent;
    }
    function p(e) {
      let t = e.split("?");
      return (
        t[0].replace(/\\/g, "/").replace(/\/\/+/g, "/") +
        (t[1] ? `?${t.slice(1).join("?")}` : "")
      );
    }
    async function h(e, t) {
      let r = t.res || (t.ctx && t.ctx.res);
      if (!e.getInitialProps)
        return t.ctx && t.Component
          ? { pageProps: await h(t.Component, t.ctx) }
          : {};
      let n = await e.getInitialProps(t);
      if (r && f(r)) return n;
      if (!n)
        throw Object.defineProperty(
          Error(
            `"${d(e)}.getInitialProps()" should resolve to an object. But found "${n}" instead.`,
          ),
          "__NEXT_ERROR_CODE",
          { value: "E394", enumerable: !1, configurable: !0 },
        );
      return n;
    }
    let m = "undefined" != typeof performance,
      g =
        m &&
        ["mark", "measure", "getEntriesByName"].every(
          (e) => "function" == typeof performance[e],
        );
    class y extends Error {}
    class v extends Error {}
    class x extends Error {
      constructor(e) {
        super(),
          (this.code = "ENOENT"),
          (this.name = "PageNotFoundError"),
          (this.message = `Cannot find module for page: ${e}`);
      }
    }
    class b extends Error {
      constructor(e, t) {
        super(),
          (this.message = `Failed to load static file for page: ${e} ${t}`);
      }
    }
    class j extends Error {
      constructor() {
        super(),
          (this.code = "ENOENT"),
          (this.message = "Cannot find the middleware module");
      }
    }
    function w(e) {
      return JSON.stringify({ message: e.message, stack: e.stack });
    }
  },
  73668,
  (e, t, r) => {
    "use strict";
    Object.defineProperty(r, "__esModule", { value: !0 }),
      Object.defineProperty(r, "isLocalURL", {
        enumerable: !0,
        get: function () {
          return i;
        },
      });
    let n = e.r(18967),
      a = e.r(52817);
    function i(e) {
      if (!(0, n.isAbsoluteUrl)(e)) return !0;
      try {
        let t = (0, n.getLocationOrigin)(),
          r = new URL(e, t);
        return r.origin === t && (0, a.hasBasePath)(r.pathname);
      } catch (e) {
        return !1;
      }
    }
  },
  84508,
  (e, t, r) => {
    "use strict";
    Object.defineProperty(r, "__esModule", { value: !0 }),
      Object.defineProperty(r, "errorOnce", {
        enumerable: !0,
        get: function () {
          return n;
        },
      });
    let n = (e) => {};
  },
  22016,
  (e, t, r) => {
    "use strict";
    Object.defineProperty(r, "__esModule", { value: !0 });
    var n = {
      default: function () {
        return y;
      },
      useLinkStatus: function () {
        return x;
      },
    };
    for (var a in n) Object.defineProperty(r, a, { enumerable: !0, get: n[a] });
    let i = e.r(90809),
      o = e.r(43476),
      s = i._(e.r(71645)),
      l = e.r(86762),
      u = e.r(8372),
      c = e.r(18581),
      d = e.r(18967),
      f = e.r(5550);
    e.r(33525);
    let p = e.r(91949),
      h = e.r(73668),
      m = e.r(65165);
    function g(e) {
      return "string" == typeof e ? e : (0, l.formatUrl)(e);
    }
    function y(t) {
      var r;
      let n,
        a,
        i,
        [l, y] = (0, s.useOptimistic)(p.IDLE_LINK_STATUS),
        x = (0, s.useRef)(null),
        {
          href: b,
          as: j,
          children: w,
          prefetch: N = null,
          passHref: S,
          replace: P,
          shallow: C,
          scroll: O,
          onClick: E,
          onMouseEnter: R,
          onTouchStart: k,
          legacyBehavior: M = !1,
          onNavigate: T,
          ref: _,
          unstable_dynamicOnHover: L,
          ...U
        } = t;
      (n = w),
        M &&
          ("string" == typeof n || "number" == typeof n) &&
          (n = (0, o.jsx)("a", { children: n }));
      let $ = s.default.useContext(u.AppRouterContext),
        I = !1 !== N,
        A =
          !1 !== N
            ? null === (r = N) || "auto" === r
              ? m.FetchStrategy.PPR
              : m.FetchStrategy.Full
            : m.FetchStrategy.PPR,
        { href: D, as: F } = s.default.useMemo(() => {
          let e = g(b);
          return { href: e, as: j ? g(j) : e };
        }, [b, j]);
      if (M) {
        if (n?.$$typeof === Symbol.for("react.lazy"))
          throw Object.defineProperty(
            Error(
              "`<Link legacyBehavior>` received a direct child that is either a Server Component, or JSX that was loaded with React.lazy(). This is not supported. Either remove legacyBehavior, or make the direct child a Client Component that renders the Link's `<a>` tag.",
            ),
            "__NEXT_ERROR_CODE",
            { value: "E863", enumerable: !1, configurable: !0 },
          );
        a = s.default.Children.only(n);
      }
      let z = M ? a && "object" == typeof a && a.ref : _,
        B = s.default.useCallback(
          (e) => (
            null !== $ &&
              (x.current = (0, p.mountLinkInstance)(e, D, $, A, I, y)),
            () => {
              x.current &&
                ((0, p.unmountLinkForCurrentNavigation)(x.current),
                (x.current = null)),
                (0, p.unmountPrefetchableInstance)(e);
            }
          ),
          [I, D, $, A, y],
        ),
        K = {
          ref: (0, c.useMergedRef)(B, z),
          onClick(t) {
            M || "function" != typeof E || E(t),
              M &&
                a.props &&
                "function" == typeof a.props.onClick &&
                a.props.onClick(t),
              !$ ||
                t.defaultPrevented ||
                (function (t, r, n, a, i, o, l) {
                  if ("undefined" != typeof window) {
                    let u,
                      { nodeName: c } = t.currentTarget;
                    if (
                      ("A" === c.toUpperCase() &&
                        (((u = t.currentTarget.getAttribute("target")) &&
                          "_self" !== u) ||
                          t.metaKey ||
                          t.ctrlKey ||
                          t.shiftKey ||
                          t.altKey ||
                          (t.nativeEvent && 2 === t.nativeEvent.which))) ||
                      t.currentTarget.hasAttribute("download")
                    )
                      return;
                    if (!(0, h.isLocalURL)(r)) {
                      i && (t.preventDefault(), location.replace(r));
                      return;
                    }
                    if ((t.preventDefault(), l)) {
                      let e = !1;
                      if (
                        (l({
                          preventDefault: () => {
                            e = !0;
                          },
                        }),
                        e)
                      )
                        return;
                    }
                    let { dispatchNavigateAction: d } = e.r(99781);
                    s.default.startTransition(() => {
                      d(n || r, i ? "replace" : "push", o ?? !0, a.current);
                    });
                  }
                })(t, D, F, x, P, O, T);
          },
          onMouseEnter(e) {
            M || "function" != typeof R || R(e),
              M &&
                a.props &&
                "function" == typeof a.props.onMouseEnter &&
                a.props.onMouseEnter(e),
              $ && I && (0, p.onNavigationIntent)(e.currentTarget, !0 === L);
          },
          onTouchStart: function (e) {
            M || "function" != typeof k || k(e),
              M &&
                a.props &&
                "function" == typeof a.props.onTouchStart &&
                a.props.onTouchStart(e),
              $ && I && (0, p.onNavigationIntent)(e.currentTarget, !0 === L);
          },
        };
      return (
        (0, d.isAbsoluteUrl)(F)
          ? (K.href = F)
          : (M && !S && ("a" !== a.type || "href" in a.props)) ||
            (K.href = (0, f.addBasePath)(F)),
        (i = M
          ? s.default.cloneElement(a, K)
          : (0, o.jsx)("a", { ...U, ...K, children: n })),
        (0, o.jsx)(v.Provider, { value: l, children: i })
      );
    }
    e.r(84508);
    let v = (0, s.createContext)(p.IDLE_LINK_STATUS),
      x = () => (0, s.useContext)(v);
    ("function" == typeof r.default ||
      ("object" == typeof r.default && null !== r.default)) &&
      void 0 === r.default.__esModule &&
      (Object.defineProperty(r.default, "__esModule", { value: !0 }),
      Object.assign(r.default, r),
      (t.exports = r.default));
  },
  93479,
  (e) => {
    "use strict";
    var t = e.i(43476),
      r = e.i(75157);
    function n({ className: e, type: n, ...a }) {
      return (0, t.jsx)("input", {
        type: n,
        "data-slot": "input",
        className: (0, r.cn)(
          "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          e,
        ),
        ...a,
      });
    }
    e.s(["Input", () => n]);
  },
  56909,
  (e) => {
    "use strict";
    let t = (0, e.i(75254).default)("save", [
      [
        "path",
        {
          d: "M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z",
          key: "1c8476",
        },
      ],
      [
        "path",
        { d: "M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7", key: "1ydtos" },
      ],
      ["path", { d: "M7 3v4a1 1 0 0 0 1 1h7", key: "t51u73" }],
    ]);
    e.s(["Save", () => t], 56909);
  },
  18566,
  (e, t, r) => {
    t.exports = e.r(76562);
  },
  87951,
  52044,
  (e) => {
    "use strict";
    var t = e.i(75254);
    let r = (0, t.default)("mic", [
      ["path", { d: "M12 19v3", key: "npa21l" }],
      ["path", { d: "M19 10v2a7 7 0 0 1-14 0v-2", key: "1vc78b" }],
      [
        "rect",
        { x: "9", y: "2", width: "6", height: "13", rx: "3", key: "s6n7sd" },
      ],
    ]);
    e.s(["Mic", () => r], 87951);
    let n = (0, t.default)("square", [
      [
        "rect",
        { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" },
      ],
    ]);
    e.s(["Square", () => n], 52044);
  },
  27612,
  (e) => {
    "use strict";
    let t = (0, e.i(75254).default)("trash-2", [
      ["path", { d: "M10 11v6", key: "nco0om" }],
      ["path", { d: "M14 11v6", key: "outv1u" }],
      [
        "path",
        { d: "M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6", key: "miytrc" },
      ],
      ["path", { d: "M3 6h18", key: "d0wm0j" }],
      ["path", { d: "M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2", key: "e791ji" }],
    ]);
    e.s(["Trash2", () => t], 27612);
  },
  74177,
  10204,
  24687,
  (e) => {
    "use strict";
    var t = e.i(43476),
      r = e.i(87951),
      n = e.i(52044),
      a = e.i(27612);
    let i = (0, e.i(75254).default)("upload", [
      ["path", { d: "M12 3v12", key: "1x0j5s" }],
      ["path", { d: "m17 8-5-5-5 5", key: "7q97r8" }],
      [
        "path",
        { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", key: "ih7n3h" },
      ],
    ]);
    var o = e.i(71645),
      s = e.i(19455),
      l = e.i(15288);
    function u({ onUploadComplete: e, onError: u }) {
      let c,
        [d, f] = (0, o.useState)(!1),
        [p, h] = (0, o.useState)(null),
        [m, g] = (0, o.useState)(null),
        [y, v] = (0, o.useState)(!1),
        [x, b] = (0, o.useState)(0),
        j = (0, o.useRef)(null),
        w = (0, o.useRef)([]),
        N = (0, o.useRef)(null);
      (0, o.useEffect)(
        () => () => {
          N.current && clearInterval(N.current), m && URL.revokeObjectURL(m);
        },
        [m],
      );
      let S = async () => {
          try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
              throw Error(
                "Media recording is not supported. Please use HTTPS or enable microphone permissions.",
              );
            let e = await navigator.mediaDevices.getUserMedia({ audio: !0 }),
              t = new MediaRecorder(e, { mimeType: "audio/webm" });
            (j.current = t),
              (w.current = []),
              (t.ondataavailable = (e) => {
                e.data.size > 0 && w.current.push(e.data);
              }),
              (t.onstop = () => {
                let t = new Blob(w.current, { type: "audio/webm" });
                h(t);
                let r = URL.createObjectURL(t);
                g(r), e.getTracks().forEach((e) => e.stop());
              }),
              t.start(),
              f(!0),
              b(0),
              (N.current = setInterval(() => {
                b((e) => e + 1);
              }, 1e3));
          } catch (e) {
            console.error("Error starting recording:", e),
              u?.(
                "Failed to start recording. Please check microphone permissions.",
              );
          }
        },
        P = async () => {
          if (p)
            try {
              v(!0);
              let t = new Date().toISOString().replace(/[:.]/g, "-"),
                r = `recording-${t}.webm`,
                n = new FormData();
              n.append("file", p, r);
              let a = await fetch("/api/files/upload", {
                method: "POST",
                body: n,
              });
              if (!a.ok) {
                let e = await a.json();
                throw Error(e.error || "Upload failed");
              }
              let i = await a.json();
              e?.(i.data.fileId, i.data.filename), C();
            } catch (e) {
              console.error("Upload error:", e),
                u?.(e instanceof Error ? e.message : "Upload failed");
            } finally {
              v(!1);
            }
        },
        C = () => {
          m && URL.revokeObjectURL(m), h(null), g(null), b(0);
        };
      return (0, t.jsx)(l.Card, {
        children: (0, t.jsxs)(l.CardContent, {
          className: "pt-6 space-y-4",
          children: [
            (0, t.jsxs)("div", {
              className: "flex items-center justify-between",
              children: [
                (0, t.jsxs)("div", {
                  className: "flex items-center gap-2",
                  children: [
                    (0, t.jsx)(r.Mic, {
                      className: `size-5 ${d ? "text-red-500 animate-pulse" : "text-muted-foreground"}`,
                    }),
                    (0, t.jsx)("span", {
                      className: "font-medium",
                      children: d
                        ? "Recording..."
                        : p
                          ? "Recording Ready"
                          : "Audio Recorder",
                    }),
                  ],
                }),
                (d || p) &&
                  (0, t.jsx)("span", {
                    className: "text-sm font-mono text-muted-foreground",
                    children:
                      ((c = Math.floor(x / 60)),
                      `${c}:${(x % 60).toString().padStart(2, "0")}`),
                  }),
              ],
            }),
            m &&
              (0, t.jsx)("audio", {
                controls: !0,
                src: m,
                className: "w-full",
              }),
            (0, t.jsxs)("div", {
              className: "flex gap-2",
              children: [
                !d &&
                  !p &&
                  (0, t.jsxs)(s.Button, {
                    onClick: S,
                    className: "flex-1",
                    children: [
                      (0, t.jsx)(r.Mic, { className: "size-4" }),
                      "Start Recording",
                    ],
                  }),
                d &&
                  (0, t.jsxs)(s.Button, {
                    onClick: () => {
                      j.current &&
                        d &&
                        (j.current.stop(),
                        f(!1),
                        N.current &&
                          (clearInterval(N.current), (N.current = null)));
                    },
                    variant: "destructive",
                    className: "flex-1",
                    children: [
                      (0, t.jsx)(n.Square, { className: "size-4" }),
                      "Stop Recording",
                    ],
                  }),
                p &&
                  !d &&
                  (0, t.jsxs)(t.Fragment, {
                    children: [
                      (0, t.jsxs)(s.Button, {
                        onClick: P,
                        disabled: y,
                        className: "flex-1",
                        children: [
                          (0, t.jsx)(i, { className: "size-4" }),
                          y ? "Uploading..." : "Upload to S3",
                        ],
                      }),
                      (0, t.jsxs)(s.Button, {
                        onClick: C,
                        variant: "outline",
                        disabled: y,
                        children: [
                          (0, t.jsx)(a.Trash2, { className: "size-4" }),
                          "Clear",
                        ],
                      }),
                    ],
                  }),
              ],
            }),
          ],
        }),
      });
    }
    e.s(["AudioRecorder", () => u], 74177), e.i(74080);
    var c = e.i(91918),
      d = [
        "a",
        "button",
        "div",
        "form",
        "h2",
        "h3",
        "img",
        "input",
        "label",
        "li",
        "nav",
        "ol",
        "p",
        "select",
        "span",
        "svg",
        "ul",
      ].reduce((e, r) => {
        let n = (0, c.createSlot)(`Primitive.${r}`),
          a = o.forwardRef((e, a) => {
            let { asChild: i, ...o } = e;
            return (
              "undefined" != typeof window &&
                (window[Symbol.for("radix-ui")] = !0),
              (0, t.jsx)(i ? n : r, { ...o, ref: a })
            );
          });
        return (a.displayName = `Primitive.${r}`), { ...e, [r]: a };
      }, {}),
      f = o.forwardRef((e, r) =>
        (0, t.jsx)(d.label, {
          ...e,
          ref: r,
          onMouseDown: (t) => {
            t.target.closest("button, input, select, textarea") ||
              (e.onMouseDown?.(t),
              !t.defaultPrevented && t.detail > 1 && t.preventDefault());
          },
        }),
      );
    f.displayName = "Label";
    var p = e.i(75157);
    function h({ className: e, ...r }) {
      return (0, t.jsx)(f, {
        "data-slot": "label",
        className: (0, p.cn)(
          "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
          e,
        ),
        ...r,
      });
    }
    function m({ className: e, ...r }) {
      return (0, t.jsx)("textarea", {
        "data-slot": "textarea",
        className: (0, p.cn)(
          "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          e,
        ),
        ...r,
      });
    }
    e.s(["Label", () => h], 10204), e.s(["Textarea", () => m], 24687);
  },
  52826,
  (e) => {
    "use strict";
    var t = e.i(43476),
      r = e.i(71689),
      n = e.i(56909),
      a = e.i(22016),
      i = e.i(18566),
      o = e.i(71645),
      s = e.i(74177),
      l = e.i(19455),
      u = e.i(15288),
      c = e.i(93479),
      d = e.i(10204),
      f = e.i(24687);
    function p() {
      let e = (0, i.useRouter)(),
        [p, h] = (0, o.useState)(""),
        [m, g] = (0, o.useState)(""),
        [y, v] = (0, o.useState)(!1),
        [x, b] = (0, o.useState)(""),
        [j, w] = (0, o.useState)([]),
        N = async (t) => {
          t.preventDefault(), b(""), v(!0);
          try {
            let t = await fetch("/api/memos", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title: p, content: m }),
            });
            if (!t.ok) {
              let e = await t.json();
              throw Error(e.error || "Failed to create memo");
            }
            let r = (await t.json()).data.id;
            j.length > 0 &&
              (await fetch(`/api/memos/${r}/files`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fileIds: j.map((e) => e.id) }),
              })),
              e.push(`/memos/${r}`);
          } catch (e) {
            b(e instanceof Error ? e.message : "Failed to create memo");
          } finally {
            v(!1);
          }
        };
      return (0, t.jsx)("div", {
        className: "min-h-screen bg-background",
        children: (0, t.jsx)("div", {
          className: "container mx-auto px-4 py-8",
          children: (0, t.jsxs)("div", {
            className: "max-w-2xl mx-auto space-y-6",
            children: [
              (0, t.jsxs)("div", {
                className: "flex items-center gap-2",
                children: [
                  (0, t.jsx)(a.default, {
                    href: "/memos",
                    children: (0, t.jsx)(l.Button, {
                      variant: "ghost",
                      size: "icon-sm",
                      children: (0, t.jsx)(r.ArrowLeft, {
                        className: "size-4",
                      }),
                    }),
                  }),
                  (0, t.jsxs)("div", {
                    children: [
                      (0, t.jsx)("h1", {
                        className: "text-3xl font-bold tracking-tight",
                        children: "New Memo",
                      }),
                      (0, t.jsx)("p", {
                        className: "text-muted-foreground",
                        children: "Create a new memo",
                      }),
                    ],
                  }),
                ],
              }),
              (0, t.jsxs)(u.Card, {
                children: [
                  (0, t.jsxs)(u.CardHeader, {
                    children: [
                      (0, t.jsx)(u.CardTitle, { children: "Memo Details" }),
                      (0, t.jsx)(u.CardDescription, {
                        children:
                          "Fill in the information below to create a new memo",
                      }),
                    ],
                  }),
                  (0, t.jsx)(u.CardContent, {
                    children: (0, t.jsxs)("form", {
                      onSubmit: N,
                      className: "space-y-4",
                      children: [
                        (0, t.jsxs)("div", {
                          className: "space-y-2",
                          children: [
                            (0, t.jsx)(d.Label, {
                              htmlFor: "title",
                              children: "Title",
                            }),
                            (0, t.jsx)(c.Input, {
                              id: "title",
                              placeholder: "Enter memo title...",
                              value: p,
                              onChange: (e) => h(e.target.value),
                              required: !0,
                              maxLength: 255,
                            }),
                          ],
                        }),
                        (0, t.jsxs)("div", {
                          className: "space-y-2",
                          children: [
                            (0, t.jsx)(d.Label, {
                              htmlFor: "content",
                              children: "Content",
                            }),
                            (0, t.jsx)(f.Textarea, {
                              id: "content",
                              placeholder: "Enter memo content...",
                              value: m,
                              onChange: (e) => g(e.target.value),
                              required: !0,
                              rows: 10,
                              className: "resize-y",
                            }),
                          ],
                        }),
                        (0, t.jsxs)("div", {
                          className: "space-y-2",
                          children: [
                            (0, t.jsx)(d.Label, {
                              children: "Audio Recording",
                            }),
                            (0, t.jsx)(s.AudioRecorder, {
                              onUploadComplete: (e, t) => {
                                w((r) => [...r, { id: e, name: t }]);
                              },
                              onError: (e) => b(e),
                            }),
                            j.length > 0 &&
                              (0, t.jsxs)("div", {
                                className: "text-sm text-muted-foreground",
                                children: [
                                  j.length,
                                  " file(s) ready to attach",
                                ],
                              }),
                          ],
                        }),
                        x &&
                          (0, t.jsx)("div", {
                            className:
                              "p-3 rounded-md bg-destructive/10 border border-destructive text-destructive text-sm",
                            children: x,
                          }),
                        (0, t.jsxs)("div", {
                          className: "flex gap-2",
                          children: [
                            (0, t.jsxs)(l.Button, {
                              type: "submit",
                              disabled: y,
                              className: "flex-1",
                              children: [
                                (0, t.jsx)(n.Save, { className: "size-4" }),
                                y ? "Creating..." : "Create Memo",
                              ],
                            }),
                            (0, t.jsx)(a.default, {
                              href: "/memos",
                              children: (0, t.jsx)(l.Button, {
                                type: "button",
                                variant: "outline",
                                children: "Cancel",
                              }),
                            }),
                          ],
                        }),
                      ],
                    }),
                  }),
                ],
              }),
            ],
          }),
        }),
      });
    }
    e.s(["default", () => p]);
  },
]);
