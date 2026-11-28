// The facts at the top of a page, read from its front matter: who it's for, the product version it was checked
// against, who owns it, and when it was last reviewed. The same fields the audit found missing (finding A12).
import React from "react";
import { useDoc } from "@docusaurus/plugin-content-docs/client";
import { translate } from "@docusaurus/Translate";
import styles from "./PageFacts.module.css";

export default function PageFacts() {
  const { frontMatter: f } = useDoc();
  // YAML reads a bare date such as 2026-11-28 as a Date; show it as written, in ISO 8601, for every locale.
  const day = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v);
  // Each label is a literal translate() call, so `docusaurus write-translations` can extract it for translators.
  // Stage 6 of the case study found these labels hard-coded in English.
  const rows = [
    [translate({ id: "pageFacts.type", message: "Type", description: "Label: the kind of page (concept, how-to, reference)" }), f.doc_type],
    [translate({ id: "pageFacts.audience", message: "For", description: "Label: who the page is written for" }), f.audience],
    [translate({ id: "pageFacts.version", message: "Checked against", description: "Label: the product version the steps were checked on" }), f.product_version],
    [translate({ id: "pageFacts.owner", message: "Owner", description: "Label: the person responsible for the page" }), f.owner],
    [translate({ id: "pageFacts.review", message: "Last review", description: "Label: the date of the page's last review" }), day(f.last_review)],
  ].filter(([, v]) => v);
  return (
    <dl className={styles.facts}>
      {rows.map(([k, v]) => (
        <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
      ))}
    </dl>
  );
}
