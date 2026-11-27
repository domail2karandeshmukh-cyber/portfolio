// @ts-check
// An independent docs-as-code demonstration: one help-center article about Keycloak, migrated to MDX and published
// with Docusaurus. It is part of karandeshmukh.dev and lives at /case-study/help-center-to-docs-as-code/site/.
// Not official Keycloak documentation, and not work done for any employer.
import { themes as prismThemes } from "prism-react-renderer";

// Prism's GitHub theme, with the token colours that fall below 4.5:1 on its grey darkened until they pass (axe-core,
// 27 November 2026). Hue kept, so the code still looks like GitHub's.
const DARKER = { "#999988": "#5f5f52", "#e3116c": "#b30d56", "#36acaa": "#1d6e6d", "#00a4db": "#006a8f", "#d73a49": "#b3262f" };
const codeTheme = {
  ...prismThemes.github,
  styles: prismThemes.github.styles.map((s) => ({ ...s, style: { ...s.style, color: DARKER[s.style.color] || s.style.color } })),
};

const REPO = "https://github.com/domail2karandeshmukh-cyber/portfolio";
const DIR = "content/case-study/docs-as-code/site";

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "Keycloak administration notes",
  tagline: "An independent docs-as-code demonstration by Karan Deshmukh",
  favicon: "img/favicon.svg",
  url: "https://karandeshmukh.dev",
  baseUrl: "/case-study/help-center-to-docs-as-code/site/",
  trailingSlash: false,
  onBrokenLinks: "throw",
  onBrokenAnchors: "throw",
  markdown: { hooks: { onBrokenMarkdownLinks: "throw", onBrokenMarkdownImages: "throw" } },
  // English is the source. qps-ploc is a pseudo-locale: machine-made, never shown as a translation, built only to
  // test that every string can be translated and that the layout survives longer text.
  i18n: {
    defaultLocale: "en",
    locales: ["en", "qps-ploc"],
    localeConfigs: {
      en: { label: "English", htmlLang: "en" },
      "qps-ploc": { label: "Pseudo-locale (test)", htmlLang: "en-x-pseudo" },
    },
  },
  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          routeBasePath: "/",
          sidebarPath: "./sidebars.js",
          editUrl: `${REPO}/blob/main/${DIR}/`,
          showLastUpdateTime: false,
        },
        blog: false,
        theme: { customCss: "./src/css/custom.css" },
      }),
    ],
  ],
  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      colorMode: { defaultMode: "light", respectPrefersColorScheme: true },
      navbar: {
        title: "Keycloak administration notes",
        items: [
          { type: "docSidebar", sidebarId: "docs", position: "left", label: "Docs" },
          { type: "localeDropdown", position: "right" },
          { href: "https://karandeshmukh.dev/case-study/help-center-to-docs-as-code", label: "The case study", position: "right" },
          { href: `${REPO}/tree/main/${DIR}`, label: "Source", position: "right" },
        ],
      },
      footer: {
        style: "light",
        copyright:
          "An independent demonstration by Karan Deshmukh, checked against Keycloak 26.8.2 on his own computer. Not official Keycloak documentation. Keycloak is a Cloud Native Computing Foundation project.",
      },
      prism: { theme: codeTheme, additionalLanguages: ["bash", "json"] },
    }),
};

export default config;
