// The callouts of these docs: eight kinds, each with one meaning, one colour and one icon (Lucide, ISC licence).
// Blue informs, dark green records a verified result, amber warns, red stops, grey adds context.
// Yellow stays the portfolio's editorial mark, and green outlines in screenshots are annotations, not callouts.
import React from "react";
import Translate from "@docusaurus/Translate";
import AdmonitionLayout from "@theme/Admonition/Layout";

const svg = (...children) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
);
const ICONS = {
  note: svg(<path key="a" d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4" />, <path key="b" d="M2 6h4M2 10h4M2 14h4M2 18h4" />, <path key="c" d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z" />),
  info: svg(<circle key="a" cx="12" cy="12" r="10" />, <path key="b" d="M12 16v-4M12 8h.01" />),
  tip: svg(<path key="a" d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />, <path key="b" d="M9 18h6M10 22h4" />),
  important: svg(<circle key="a" cx="12" cy="12" r="10" />, <path key="b" d="M12 8v4M12 16h.01" />),
  caution: svg(<path key="a" d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />, <path key="b" d="M12 9v4M12 17h.01" />),
  danger: svg(<path key="a" d="M2.586 16.726A2 2 0 0 1 2 15.312V8.688a2 2 0 0 1 .586-1.414l4.688-4.688A2 2 0 0 1 8.688 2h6.624a2 2 0 0 1 1.414.586l4.688 4.688A2 2 0 0 1 22 8.688v6.624a2 2 0 0 1-.586 1.414l-4.688 4.688a2 2 0 0 1-1.414.586H8.688a2 2 0 0 1-1.414-.586z" />, <path key="b" d="m15 9-6 6M9 9l6 6" />),
  verified: svg(<circle key="a" cx="12" cy="12" r="10" />, <path key="b" d="m16 9-5.5 5.5L8 12" />),
};
// Literal IDs, so that docusaurus write-translations can find them for the pseudo-locale.
const LABELS = {
  note: <Translate id="theme.admonition.note">Note</Translate>,
  info: <Translate id="theme.admonition.info">Information</Translate>,
  tip: <Translate id="theme.admonition.tip">Tip</Translate>,
  important: <Translate id="theme.admonition.important">Important</Translate>,
  caution: <Translate id="theme.admonition.caution">Caution</Translate>,
  warning: <Translate id="theme.admonition.warning">Warning</Translate>,
  danger: <Translate id="theme.admonition.danger">Danger</Translate>,
  verified: <Translate id="theme.admonition.verified">Verified result</Translate>,
};

function make(kind, icon = kind) {
  return function Callout(props) {
    return (
      <AdmonitionLayout
        icon={ICONS[icon]}
        title={LABELS[kind]}
        {...props}
        className={`callout callout--${kind} ${props.className || ""}`}>
        {props.children}
      </AdmonitionLayout>
    );
  };
}

export default {
  note: make("note"), info: make("info"), tip: make("tip"), important: make("important"),
  caution: make("caution"), warning: make("warning", "caution"), danger: make("danger"), verified: make("verified"),
};
