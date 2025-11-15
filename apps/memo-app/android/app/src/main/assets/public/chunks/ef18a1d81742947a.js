(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([
  "object" == typeof document ? document.currentScript : void 0,
  87486,
  (e) => {
    "use strict";
    var t = e.i(43476),
      r = e.i(91918),
      a = e.i(25913),
      n = e.i(75157);
    let i = (0, a.cva)(
      "inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
      {
        variants: {
          variant: {
            default:
              "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
            secondary:
              "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
            destructive:
              "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
            outline:
              "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
          },
        },
        defaultVariants: { variant: "default" },
      },
    );
    function s({ className: e, variant: a, asChild: s = !1, ...o }) {
      let l = s ? r.Slot : "span";
      return (0, t.jsx)(l, {
        "data-slot": "badge",
        className: (0, n.cn)(i({ variant: a }), e),
        ...o,
      });
    }
    e.s(["Badge", () => s]);
  },
  33525,
  (e, t, r) => {
    "use strict";
    Object.defineProperty(r, "__esModule", { value: !0 }),
      Object.defineProperty(r, "warnOnce", {
        enumerable: !0,
        get: function () {
          return a;
        },
      });
    let a = (e) => {};
  },
  98183,
  (e, t, r) => {
    "use strict";
    Object.defineProperty(r, "__esModule", { value: !0 });
    var a = {
      assign: function () {
        return l;
      },
      searchParamsToUrlQuery: function () {
        return i;
      },
      urlQueryToSearchParams: function () {
        return o;
      },
    };
    for (var n in a) Object.defineProperty(r, n, { enumerable: !0, get: a[n] });
    function i(e) {
      let t = {};
      for (let [r, a] of e.entries()) {
        let e = t[r];
        void 0 === e
          ? (t[r] = a)
          : Array.isArray(e)
            ? e.push(a)
            : (t[r] = [e, a]);
      }
      return t;
    }
    function s(e) {
      return "string" == typeof e
        ? e
        : ("number" != typeof e || isNaN(e)) && "boolean" != typeof e
          ? ""
          : String(e);
    }
    function o(e) {
      let t = new URLSearchParams();
      for (let [r, a] of Object.entries(e))
        if (Array.isArray(a)) for (let e of a) t.append(r, s(e));
        else t.set(r, s(a));
      return t;
    }
    function l(e, ...t) {
      for (let r of t) {
        for (let t of r.keys()) e.delete(t);
        for (let [t, a] of r.entries()) e.append(t, a);
      }
      return e;
    }
  },
  86762,
  (e, t, r) => {
    "use strict";
    Object.defineProperty(r, "__esModule", { value: !0 });
    var a = {
      formatUrl: function () {
        return o;
      },
      formatWithValidation: function () {
        return c;
      },
      urlObjectKeys: function () {
        return l;
      },
    };
    for (var n in a) Object.defineProperty(r, n, { enumerable: !0, get: a[n] });
    let i = e.r(90809)._(e.r(98183)),
      s = /https?|ftp|gopher|file/;
    function o(e) {
      let { auth: t, hostname: r } = e,
        a = e.protocol || "",
        n = e.pathname || "",
        o = e.hash || "",
        l = e.query || "",
        c = !1;
      (t = t ? encodeURIComponent(t).replace(/%3A/i, ":") + "@" : ""),
        e.host
          ? (c = t + e.host)
          : r &&
            ((c = t + (~r.indexOf(":") ? `[${r}]` : r)),
            e.port && (c += ":" + e.port)),
        l && "object" == typeof l && (l = String(i.urlQueryToSearchParams(l)));
      let d = e.search || (l && `?${l}`) || "";
      return (
        a && !a.endsWith(":") && (a += ":"),
        e.slashes || ((!a || s.test(a)) && !1 !== c)
          ? ((c = "//" + (c || "")), n && "/" !== n[0] && (n = "/" + n))
          : c || (c = ""),
        o && "#" !== o[0] && (o = "#" + o),
        d && "?" !== d[0] && (d = "?" + d),
        (n = n.replace(/[?#]/g, encodeURIComponent)),
        (d = d.replace("#", "%23")),
        `${a}${c}${n}${d}${o}`
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
    function c(e) {
      return o(e);
    }
  },
  18581,
  (e, t, r) => {
    "use strict";
    Object.defineProperty(r, "__esModule", { value: !0 }),
      Object.defineProperty(r, "useMergedRef", {
        enumerable: !0,
        get: function () {
          return n;
        },
      });
    let a = e.r(71645);
    function n(e, t) {
      let r = (0, a.useRef)(null),
        n = (0, a.useRef)(null);
      return (0, a.useCallback)(
        (a) => {
          if (null === a) {
            let e = r.current;
            e && ((r.current = null), e());
            let t = n.current;
            t && ((n.current = null), t());
          } else e && (r.current = i(e, a)), t && (n.current = i(t, a));
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
    var a = {
      DecodeError: function () {
        return x;
      },
      MiddlewareNotFoundError: function () {
        return j;
      },
      MissingStaticPage: function () {
        return y;
      },
      NormalizeError: function () {
        return v;
      },
      PageNotFoundError: function () {
        return b;
      },
      SP: function () {
        return h;
      },
      ST: function () {
        return g;
      },
      WEB_VITALS: function () {
        return i;
      },
      execOnce: function () {
        return s;
      },
      getDisplayName: function () {
        return u;
      },
      getLocationOrigin: function () {
        return c;
      },
      getURL: function () {
        return d;
      },
      isAbsoluteUrl: function () {
        return l;
      },
      isResSent: function () {
        return f;
      },
      loadGetInitialProps: function () {
        return p;
      },
      normalizeRepeatedSlashes: function () {
        return m;
      },
      stringifyError: function () {
        return N;
      },
    };
    for (var n in a) Object.defineProperty(r, n, { enumerable: !0, get: a[n] });
    let i = ["CLS", "FCP", "FID", "INP", "LCP", "TTFB"];
    function s(e) {
      let t,
        r = !1;
      return (...a) => (r || ((r = !0), (t = e(...a))), t);
    }
    let o = /^[a-zA-Z][a-zA-Z\d+\-.]*?:/,
      l = (e) => o.test(e);
    function c() {
      let { protocol: e, hostname: t, port: r } = window.location;
      return `${e}//${t}${r ? ":" + r : ""}`;
    }
    function d() {
      let { href: e } = window.location,
        t = c();
      return e.substring(t.length);
    }
    function u(e) {
      return "string" == typeof e ? e : e.displayName || e.name || "Unknown";
    }
    function f(e) {
      return e.finished || e.headersSent;
    }
    function m(e) {
      let t = e.split("?");
      return (
        t[0].replace(/\\/g, "/").replace(/\/\/+/g, "/") +
        (t[1] ? `?${t.slice(1).join("?")}` : "")
      );
    }
    async function p(e, t) {
      let r = t.res || (t.ctx && t.ctx.res);
      if (!e.getInitialProps)
        return t.ctx && t.Component
          ? { pageProps: await p(t.Component, t.ctx) }
          : {};
      let a = await e.getInitialProps(t);
      if (r && f(r)) return a;
      if (!a)
        throw Object.defineProperty(
          Error(
            `"${u(e)}.getInitialProps()" should resolve to an object. But found "${a}" instead.`,
          ),
          "__NEXT_ERROR_CODE",
          { value: "E394", enumerable: !1, configurable: !0 },
        );
      return a;
    }
    let h = "undefined" != typeof performance,
      g =
        h &&
        ["mark", "measure", "getEntriesByName"].every(
          (e) => "function" == typeof performance[e],
        );
    class x extends Error {}
    class v extends Error {}
    class b extends Error {
      constructor(e) {
        super(),
          (this.code = "ENOENT"),
          (this.name = "PageNotFoundError"),
          (this.message = `Cannot find module for page: ${e}`);
      }
    }
    class y extends Error {
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
    function N(e) {
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
    let a = e.r(18967),
      n = e.r(52817);
    function i(e) {
      if (!(0, a.isAbsoluteUrl)(e)) return !0;
      try {
        let t = (0, a.getLocationOrigin)(),
          r = new URL(e, t);
        return r.origin === t && (0, n.hasBasePath)(r.pathname);
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
          return a;
        },
      });
    let a = (e) => {};
  },
  22016,
  (e, t, r) => {
    "use strict";
    Object.defineProperty(r, "__esModule", { value: !0 });
    var a = {
      default: function () {
        return x;
      },
      useLinkStatus: function () {
        return b;
      },
    };
    for (var n in a) Object.defineProperty(r, n, { enumerable: !0, get: a[n] });
    let i = e.r(90809),
      s = e.r(43476),
      o = i._(e.r(71645)),
      l = e.r(86762),
      c = e.r(8372),
      d = e.r(18581),
      u = e.r(18967),
      f = e.r(5550);
    e.r(33525);
    let m = e.r(91949),
      p = e.r(73668),
      h = e.r(65165);
    function g(e) {
      return "string" == typeof e ? e : (0, l.formatUrl)(e);
    }
    function x(t) {
      var r;
      let a,
        n,
        i,
        [l, x] = (0, o.useOptimistic)(m.IDLE_LINK_STATUS),
        b = (0, o.useRef)(null),
        {
          href: y,
          as: j,
          children: N,
          prefetch: w = null,
          passHref: S,
          replace: C,
          shallow: E,
          scroll: k,
          onClick: R,
          onMouseEnter: P,
          onTouchStart: T,
          legacyBehavior: M = !1,
          onNavigate: O,
          ref: I,
          unstable_dynamicOnHover: L,
          ...A
        } = t;
      (a = N),
        M &&
          ("string" == typeof a || "number" == typeof a) &&
          (a = (0, s.jsx)("a", { children: a }));
      let U = o.default.useContext(c.AppRouterContext),
        _ = !1 !== w,
        D =
          !1 !== w
            ? null === (r = w) || "auto" === r
              ? h.FetchStrategy.PPR
              : h.FetchStrategy.Full
            : h.FetchStrategy.PPR,
        { href: $, as: F } = o.default.useMemo(() => {
          let e = g(y);
          return { href: e, as: j ? g(j) : e };
        }, [y, j]);
      if (M) {
        if (a?.$$typeof === Symbol.for("react.lazy"))
          throw Object.defineProperty(
            Error(
              "`<Link legacyBehavior>` received a direct child that is either a Server Component, or JSX that was loaded with React.lazy(). This is not supported. Either remove legacyBehavior, or make the direct child a Client Component that renders the Link's `<a>` tag.",
            ),
            "__NEXT_ERROR_CODE",
            { value: "E863", enumerable: !1, configurable: !0 },
          );
        n = o.default.Children.only(a);
      }
      let z = M ? n && "object" == typeof n && n.ref : I,
        B = o.default.useCallback(
          (e) => (
            null !== U &&
              (b.current = (0, m.mountLinkInstance)(e, $, U, D, _, x)),
            () => {
              b.current &&
                ((0, m.unmountLinkForCurrentNavigation)(b.current),
                (b.current = null)),
                (0, m.unmountPrefetchableInstance)(e);
            }
          ),
          [_, $, U, D, x],
        ),
        V = {
          ref: (0, d.useMergedRef)(B, z),
          onClick(t) {
            M || "function" != typeof R || R(t),
              M &&
                n.props &&
                "function" == typeof n.props.onClick &&
                n.props.onClick(t),
              !U ||
                t.defaultPrevented ||
                (function (t, r, a, n, i, s, l) {
                  if ("undefined" != typeof window) {
                    let c,
                      { nodeName: d } = t.currentTarget;
                    if (
                      ("A" === d.toUpperCase() &&
                        (((c = t.currentTarget.getAttribute("target")) &&
                          "_self" !== c) ||
                          t.metaKey ||
                          t.ctrlKey ||
                          t.shiftKey ||
                          t.altKey ||
                          (t.nativeEvent && 2 === t.nativeEvent.which))) ||
                      t.currentTarget.hasAttribute("download")
                    )
                      return;
                    if (!(0, p.isLocalURL)(r)) {
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
                    let { dispatchNavigateAction: u } = e.r(99781);
                    o.default.startTransition(() => {
                      u(a || r, i ? "replace" : "push", s ?? !0, n.current);
                    });
                  }
                })(t, $, F, b, C, k, O);
          },
          onMouseEnter(e) {
            M || "function" != typeof P || P(e),
              M &&
                n.props &&
                "function" == typeof n.props.onMouseEnter &&
                n.props.onMouseEnter(e),
              U && _ && (0, m.onNavigationIntent)(e.currentTarget, !0 === L);
          },
          onTouchStart: function (e) {
            M || "function" != typeof T || T(e),
              M &&
                n.props &&
                "function" == typeof n.props.onTouchStart &&
                n.props.onTouchStart(e),
              U && _ && (0, m.onNavigationIntent)(e.currentTarget, !0 === L);
          },
        };
      return (
        (0, u.isAbsoluteUrl)(F)
          ? (V.href = F)
          : (M && !S && ("a" !== n.type || "href" in n.props)) ||
            (V.href = (0, f.addBasePath)(F)),
        (i = M
          ? o.default.cloneElement(n, V)
          : (0, s.jsx)("a", { ...A, ...V, children: a })),
        (0, s.jsx)(v.Provider, { value: l, children: i })
      );
    }
    e.r(84508);
    let v = (0, o.createContext)(m.IDLE_LINK_STATUS),
      b = () => (0, o.useContext)(v);
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
    function a({ className: e, type: a, ...n }) {
      return (0, t.jsx)("input", {
        type: a,
        "data-slot": "input",
        className: (0, r.cn)(
          "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
          "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
          e,
        ),
        ...n,
      });
    }
    e.s(["Input", () => a]);
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
    let a = (0, t.default)("square", [
      [
        "rect",
        { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" },
      ],
    ]);
    e.s(["Square", () => a], 52044);
  },
  74177,
  10204,
  24687,
  (e) => {
    "use strict";
    var t = e.i(43476),
      r = e.i(87951),
      a = e.i(52044),
      n = e.i(27612);
    let i = (0, e.i(75254).default)("upload", [
      ["path", { d: "M12 3v12", key: "1x0j5s" }],
      ["path", { d: "m17 8-5-5-5 5", key: "7q97r8" }],
      [
        "path",
        { d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", key: "ih7n3h" },
      ],
    ]);
    var s = e.i(71645),
      o = e.i(19455),
      l = e.i(15288);
    function c({ onUploadComplete: e, onError: c }) {
      let d,
        [u, f] = (0, s.useState)(!1),
        [m, p] = (0, s.useState)(null),
        [h, g] = (0, s.useState)(null),
        [x, v] = (0, s.useState)(!1),
        [b, y] = (0, s.useState)(0),
        j = (0, s.useRef)(null),
        N = (0, s.useRef)([]),
        w = (0, s.useRef)(null);
      (0, s.useEffect)(
        () => () => {
          w.current && clearInterval(w.current), h && URL.revokeObjectURL(h);
        },
        [h],
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
              (N.current = []),
              (t.ondataavailable = (e) => {
                e.data.size > 0 && N.current.push(e.data);
              }),
              (t.onstop = () => {
                let t = new Blob(N.current, { type: "audio/webm" });
                p(t);
                let r = URL.createObjectURL(t);
                g(r), e.getTracks().forEach((e) => e.stop());
              }),
              t.start(),
              f(!0),
              y(0),
              (w.current = setInterval(() => {
                y((e) => e + 1);
              }, 1e3));
          } catch (e) {
            console.error("Error starting recording:", e),
              c?.(
                "Failed to start recording. Please check microphone permissions.",
              );
          }
        },
        C = async () => {
          if (m)
            try {
              v(!0);
              let t = new Date().toISOString().replace(/[:.]/g, "-"),
                r = `recording-${t}.webm`,
                a = new FormData();
              a.append("file", m, r);
              let n = await fetch("/api/files/upload", {
                method: "POST",
                body: a,
              });
              if (!n.ok) {
                let e = await n.json();
                throw Error(e.error || "Upload failed");
              }
              let i = await n.json();
              e?.(i.data.fileId, i.data.filename), E();
            } catch (e) {
              console.error("Upload error:", e),
                c?.(e instanceof Error ? e.message : "Upload failed");
            } finally {
              v(!1);
            }
        },
        E = () => {
          h && URL.revokeObjectURL(h), p(null), g(null), y(0);
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
                      className: `size-5 ${u ? "text-red-500 animate-pulse" : "text-muted-foreground"}`,
                    }),
                    (0, t.jsx)("span", {
                      className: "font-medium",
                      children: u
                        ? "Recording..."
                        : m
                          ? "Recording Ready"
                          : "Audio Recorder",
                    }),
                  ],
                }),
                (u || m) &&
                  (0, t.jsx)("span", {
                    className: "text-sm font-mono text-muted-foreground",
                    children:
                      ((d = Math.floor(b / 60)),
                      `${d}:${(b % 60).toString().padStart(2, "0")}`),
                  }),
              ],
            }),
            h &&
              (0, t.jsx)("audio", {
                controls: !0,
                src: h,
                className: "w-full",
              }),
            (0, t.jsxs)("div", {
              className: "flex gap-2",
              children: [
                !u &&
                  !m &&
                  (0, t.jsxs)(o.Button, {
                    onClick: S,
                    className: "flex-1",
                    children: [
                      (0, t.jsx)(r.Mic, { className: "size-4" }),
                      "Start Recording",
                    ],
                  }),
                u &&
                  (0, t.jsxs)(o.Button, {
                    onClick: () => {
                      j.current &&
                        u &&
                        (j.current.stop(),
                        f(!1),
                        w.current &&
                          (clearInterval(w.current), (w.current = null)));
                    },
                    variant: "destructive",
                    className: "flex-1",
                    children: [
                      (0, t.jsx)(a.Square, { className: "size-4" }),
                      "Stop Recording",
                    ],
                  }),
                m &&
                  !u &&
                  (0, t.jsxs)(t.Fragment, {
                    children: [
                      (0, t.jsxs)(o.Button, {
                        onClick: C,
                        disabled: x,
                        className: "flex-1",
                        children: [
                          (0, t.jsx)(i, { className: "size-4" }),
                          x ? "Uploading..." : "Upload to S3",
                        ],
                      }),
                      (0, t.jsxs)(o.Button, {
                        onClick: E,
                        variant: "outline",
                        disabled: x,
                        children: [
                          (0, t.jsx)(n.Trash2, { className: "size-4" }),
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
    e.s(["AudioRecorder", () => c], 74177), e.i(74080);
    var d = e.i(91918),
      u = [
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
        let a = (0, d.createSlot)(`Primitive.${r}`),
          n = s.forwardRef((e, n) => {
            let { asChild: i, ...s } = e;
            return (
              "undefined" != typeof window &&
                (window[Symbol.for("radix-ui")] = !0),
              (0, t.jsx)(i ? a : r, { ...s, ref: n })
            );
          });
        return (n.displayName = `Primitive.${r}`), { ...e, [r]: n };
      }, {}),
      f = s.forwardRef((e, r) =>
        (0, t.jsx)(u.label, {
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
    var m = e.i(75157);
    function p({ className: e, ...r }) {
      return (0, t.jsx)(f, {
        "data-slot": "label",
        className: (0, m.cn)(
          "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
          e,
        ),
        ...r,
      });
    }
    function h({ className: e, ...r }) {
      return (0, t.jsx)("textarea", {
        "data-slot": "textarea",
        className: (0, m.cn)(
          "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          e,
        ),
        ...r,
      });
    }
    e.s(["Label", () => p], 10204), e.s(["Textarea", () => h], 24687);
  },
  83260,
  (e) => {
    "use strict";
    var t = e.i(43476),
      r = e.i(71689);
    let a = (0, e.i(75254).default)("file-headphone", [
      [
        "path",
        {
          d: "M4 6.835V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2h-.343",
          key: "1vfytu",
        },
      ],
      ["path", { d: "M14 2v5a1 1 0 0 0 1 1h5", key: "wfsgrz" }],
      [
        "path",
        {
          d: "M2 19a2 2 0 0 1 4 0v1a2 2 0 0 1-4 0v-4a6 6 0 0 1 12 0v4a2 2 0 0 1-4 0v-1a2 2 0 0 1 4 0",
          key: "1etmh7",
        },
      ],
    ]);
    var n = e.i(56909),
      i = e.i(27612),
      s = e.i(22016),
      o = e.i(18566),
      l = e.i(71645),
      c = e.i(74177),
      d = e.i(87486),
      u = e.i(19455),
      f = e.i(15288),
      m = e.i(93479),
      p = e.i(10204),
      h = e.i(67489),
      g = e.i(24687);
    let x = {
      DRAFT: "bg-slate-500",
      PREPARING: "bg-blue-500",
      RUNNING: "bg-yellow-500",
      DONE: "bg-green-500",
      CANCELLED: "bg-gray-500",
      FAILED: "bg-red-500",
      ARCHIVED: "bg-zinc-500",
    };
    function v({ params: e }) {
      let { id: v } = (0, l.use)(e),
        b = (0, o.useRouter)(),
        [y, j] = (0, l.useState)(null),
        [N, w] = (0, l.useState)(""),
        [S, C] = (0, l.useState)(""),
        [E, k] = (0, l.useState)("DRAFT"),
        [R, P] = (0, l.useState)(!0),
        [T, M] = (0, l.useState)(!1),
        [O, I] = (0, l.useState)(""),
        [L, A] = (0, l.useState)([]),
        [U, _] = (0, l.useState)(!1),
        D = (0, l.useCallback)(async () => {
          try {
            P(!0);
            let e = await fetch(`/api/memos/${v}`);
            if (!e.ok) throw Error("Memo not found");
            let t = await e.json();
            j(t.data),
              w(t.data.title),
              C(t.data.content),
              k(t.data.status),
              _(!0);
            let r = await fetch(`/api/memos/${v}/files`);
            if (r.ok) {
              let e = await r.json();
              A(
                e.data.map((e) => ({
                  id: e.id,
                  filename: e.filename,
                  size: e.size,
                })),
              );
            }
            _(!1);
          } catch (e) {
            I(e instanceof Error ? e.message : "Failed to load memo");
          } finally {
            P(!1);
          }
        }, [v]);
      (0, l.useEffect)(() => {
        D();
      }, [D]);
      let $ = async (e) => {
          e.preventDefault(), I(""), M(!0);
          let t = y?.status,
            r = "RUNNING" === E && "RUNNING" !== t;
          try {
            let e = await fetch(`/api/memos/${v}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title: N, content: S, status: E }),
            });
            if (!e.ok) {
              let t = await e.json();
              throw Error(t.error || "Failed to update memo");
            }
            let t = await e.json();
            j(t.data),
              r &&
                L.some((e) => e.filename.match(/\.(webm|wav|mp3|ogg|m4a)$/i)) &&
                alert(
                  "Memo set to RUNNING! Audio transcription jobs have been queued automatically. Check the Queue Dashboard to monitor progress.",
                );
          } catch (e) {
            I(e instanceof Error ? e.message : "Failed to update memo");
          } finally {
            M(!1);
          }
        },
        F = async () => {
          if (confirm("Are you sure you want to delete this memo?"))
            try {
              M(!0);
              let e = await fetch(`/api/memos/${v}`, { method: "DELETE" });
              if (!e.ok) {
                let t = await e.json();
                throw Error(t.error || "Failed to delete memo");
              }
              b.push("/memos");
            } catch (e) {
              I(e instanceof Error ? e.message : "Failed to delete memo"),
                M(!1);
            }
        },
        z = async (e, t) => {
          try {
            let r = await fetch(`/api/memos/${v}/files`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fileIds: [e] }),
            });
            if (!r.ok) {
              let e = await r.json();
              throw Error(e.error || "Failed to attach file");
            }
            A((r) => [...r, { id: e, filename: t, size: 0 }]), await D();
          } catch (e) {
            I(e instanceof Error ? e.message : "Failed to attach audio file");
          }
        },
        B = async () => {
          if (confirm("Transcribe all audio files attached to this memo?"))
            try {
              M(!0);
              let e = await fetch(`/api/memos/${v}/transcribe`, {
                method: "POST",
              });
              if (!e.ok) {
                let t = await e.json();
                throw Error(t.error || "Failed to queue transcriptions");
              }
              let t = await e.json();
              alert(
                `Queued ${t.jobs?.length || 0} transcription job(s). Check the Queue Dashboard for status.`,
              );
            } catch (e) {
              I(e instanceof Error ? e.message : "Failed to transcribe files");
            } finally {
              M(!1);
            }
        };
      return R
        ? (0, t.jsx)("div", {
            className:
              "min-h-screen bg-background flex items-center justify-center",
            children: (0, t.jsx)("div", {
              className: "text-muted-foreground",
              children: "Loading memo...",
            }),
          })
        : O && !y
          ? (0, t.jsx)("div", {
              className: "min-h-screen bg-background",
              children: (0, t.jsx)("div", {
                className: "container mx-auto px-4 py-8",
                children: (0, t.jsx)("div", {
                  className: "max-w-2xl mx-auto",
                  children: (0, t.jsx)(f.Card, {
                    children: (0, t.jsxs)(f.CardContent, {
                      className: "py-12 text-center",
                      children: [
                        (0, t.jsx)("p", {
                          className: "text-destructive mb-4",
                          children: O,
                        }),
                        (0, t.jsx)(s.default, {
                          href: "/memos",
                          children: (0, t.jsx)(u.Button, {
                            children: "Back to Memos",
                          }),
                        }),
                      ],
                    }),
                  }),
                }),
              }),
            })
          : (0, t.jsx)("div", {
              className: "min-h-screen bg-background",
              children: (0, t.jsx)("div", {
                className: "container mx-auto px-4 py-8",
                children: (0, t.jsxs)("div", {
                  className: "max-w-2xl mx-auto space-y-6",
                  children: [
                    (0, t.jsxs)("div", {
                      className: "flex items-center justify-between",
                      children: [
                        (0, t.jsxs)("div", {
                          className: "flex items-center gap-2",
                          children: [
                            (0, t.jsx)(s.default, {
                              href: "/memos",
                              children: (0, t.jsx)(u.Button, {
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
                                  className:
                                    "text-3xl font-bold tracking-tight",
                                  children: "Edit Memo",
                                }),
                                (0, t.jsxs)("p", {
                                  className: "text-sm text-muted-foreground",
                                  children: [
                                    "Created ",
                                    y && new Date(y.createdAt).toLocaleString(),
                                  ],
                                }),
                              ],
                            }),
                          ],
                        }),
                        (0, t.jsx)(d.Badge, {
                          className: x[E],
                          variant: "default",
                          children: E,
                        }),
                      ],
                    }),
                    (0, t.jsxs)(f.Card, {
                      children: [
                        (0, t.jsxs)(f.CardHeader, {
                          children: [
                            (0, t.jsx)(f.CardTitle, {
                              children: "Memo Details",
                            }),
                            (0, t.jsx)(f.CardDescription, {
                              children: "Update your memo information",
                            }),
                          ],
                        }),
                        (0, t.jsx)(f.CardContent, {
                          children: (0, t.jsxs)("form", {
                            onSubmit: $,
                            className: "space-y-4",
                            children: [
                              (0, t.jsxs)("div", {
                                className: "space-y-2",
                                children: [
                                  (0, t.jsx)(p.Label, {
                                    htmlFor: "title",
                                    children: "Title",
                                  }),
                                  (0, t.jsx)(m.Input, {
                                    id: "title",
                                    placeholder: "Enter memo title...",
                                    value: N,
                                    onChange: (e) => w(e.target.value),
                                    required: !0,
                                    maxLength: 255,
                                  }),
                                ],
                              }),
                              (0, t.jsxs)("div", {
                                className: "space-y-2",
                                children: [
                                  (0, t.jsx)(p.Label, {
                                    htmlFor: "content",
                                    children: "Content",
                                  }),
                                  (0, t.jsx)(g.Textarea, {
                                    id: "content",
                                    placeholder: "Enter memo content...",
                                    value: S,
                                    onChange: (e) => C(e.target.value),
                                    required: !0,
                                    rows: 10,
                                    className: "resize-y",
                                  }),
                                ],
                              }),
                              (0, t.jsxs)("div", {
                                className: "space-y-2",
                                children: [
                                  (0, t.jsx)(p.Label, {
                                    htmlFor: "status",
                                    children: "Status",
                                  }),
                                  (0, t.jsxs)(h.Select, {
                                    value: E,
                                    onValueChange: (e) => k(e),
                                    children: [
                                      (0, t.jsx)(h.SelectTrigger, {
                                        id: "status",
                                        children: (0, t.jsx)(h.SelectValue, {}),
                                      }),
                                      (0, t.jsxs)(h.SelectContent, {
                                        children: [
                                          (0, t.jsx)(h.SelectItem, {
                                            value: "DRAFT",
                                            children: "Draft",
                                          }),
                                          (0, t.jsx)(h.SelectItem, {
                                            value: "PREPARING",
                                            children: "Preparing",
                                          }),
                                          (0, t.jsx)(h.SelectItem, {
                                            value: "RUNNING",
                                            children:
                                              "Running (Auto-transcribe audio)",
                                          }),
                                          (0, t.jsx)(h.SelectItem, {
                                            value: "DONE",
                                            children: "Done",
                                          }),
                                          (0, t.jsx)(h.SelectItem, {
                                            value: "CANCELLED",
                                            children: "Cancelled",
                                          }),
                                          (0, t.jsx)(h.SelectItem, {
                                            value: "FAILED",
                                            children: "Failed",
                                          }),
                                          (0, t.jsx)(h.SelectItem, {
                                            value: "ARCHIVED",
                                            children: "Archived",
                                          }),
                                        ],
                                      }),
                                    ],
                                  }),
                                  "RUNNING" === E &&
                                    L.some((e) =>
                                      e.filename.match(
                                        /\.(webm|wav|mp3|ogg|m4a)$/i,
                                      ),
                                    ) &&
                                    (0, t.jsx)("p", {
                                      className:
                                        "text-xs text-muted-foreground",
                                      children:
                                        "Setting to RUNNING will automatically transcribe all audio files",
                                    }),
                                ],
                              }),
                              (0, t.jsxs)("div", {
                                className: "space-y-2",
                                children: [
                                  (0, t.jsx)(p.Label, {
                                    children: "Audio Recording",
                                  }),
                                  (0, t.jsx)(c.AudioRecorder, {
                                    onUploadComplete: z,
                                    onError: (e) => I(e),
                                  }),
                                ],
                              }),
                              (L.length > 0 || U) &&
                                (0, t.jsxs)(f.Card, {
                                  children: [
                                    (0, t.jsxs)(f.CardHeader, {
                                      className:
                                        "flex flex-row items-center justify-between",
                                      children: [
                                        (0, t.jsxs)(f.CardTitle, {
                                          className:
                                            "text-base flex items-center gap-2",
                                          children: [
                                            (0, t.jsx)(a, {
                                              className: "size-4",
                                            }),
                                            "Attached Files",
                                            " ",
                                            L.length > 0 && `(${L.length})`,
                                          ],
                                        }),
                                        L.some((e) =>
                                          e.filename.match(
                                            /\.(webm|wav|mp3|ogg|m4a)$/i,
                                          ),
                                        ) &&
                                          (0, t.jsx)(u.Button, {
                                            onClick: B,
                                            variant: "outline",
                                            size: "sm",
                                            disabled: T,
                                            children: "Transcribe All",
                                          }),
                                      ],
                                    }),
                                    (0, t.jsx)(f.CardContent, {
                                      className: "space-y-4",
                                      children:
                                        U && !L.length
                                          ? (0, t.jsx)("div", {
                                              className:
                                                "text-sm text-muted-foreground",
                                              children: "Loading files...",
                                            })
                                          : L.map((e) =>
                                              (0, t.jsxs)(
                                                "div",
                                                {
                                                  className:
                                                    "space-y-2 p-3 border rounded-md",
                                                  children: [
                                                    (0, t.jsxs)("div", {
                                                      className:
                                                        "flex items-center justify-between",
                                                      children: [
                                                        (0, t.jsxs)("div", {
                                                          className:
                                                            "flex items-center gap-2",
                                                          children: [
                                                            (0, t.jsx)(a, {
                                                              className:
                                                                "size-4 text-muted-foreground",
                                                            }),
                                                            (0, t.jsx)("span", {
                                                              className:
                                                                "text-sm font-medium",
                                                              children:
                                                                e.filename,
                                                            }),
                                                          ],
                                                        }),
                                                        (0, t.jsx)("a", {
                                                          href: `/api/files/${e.id}/download`,
                                                          download: !0,
                                                          className:
                                                            "text-xs text-primary hover:underline",
                                                          children: "Download",
                                                        }),
                                                      ],
                                                    }),
                                                    e.filename.match(
                                                      /\.(webm|wav|mp3|ogg|m4a)$/i,
                                                    ) &&
                                                      (0, t.jsx)("audio", {
                                                        controls: !0,
                                                        src: `/api/files/${e.id}/download`,
                                                        className: "w-full",
                                                      }),
                                                  ],
                                                },
                                                e.id,
                                              ),
                                            ),
                                    }),
                                  ],
                                }),
                              O &&
                                (0, t.jsx)("div", {
                                  className:
                                    "p-3 rounded-md bg-destructive/10 border border-destructive text-destructive text-sm",
                                  children: O,
                                }),
                              (0, t.jsxs)("div", {
                                className: "flex gap-2",
                                children: [
                                  (0, t.jsxs)(u.Button, {
                                    type: "submit",
                                    disabled: T,
                                    className: "flex-1",
                                    children: [
                                      (0, t.jsx)(n.Save, {
                                        className: "size-4",
                                      }),
                                      T ? "Saving..." : "Save Changes",
                                    ],
                                  }),
                                  (0, t.jsxs)(u.Button, {
                                    type: "button",
                                    variant: "destructive",
                                    onClick: F,
                                    disabled: T,
                                    children: [
                                      (0, t.jsx)(i.Trash2, {
                                        className: "size-4",
                                      }),
                                      "Delete",
                                    ],
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
    e.s(["default", () => v], 83260);
  },
]);
