// The facts at the top of a page, read from its front matter: who it's for, the product version it was checked
// against, who owns it, and when it was last reviewed. The same fields the audit found missing (finding A12).
import React from "react";
import { useDoc } from "@docusaurus/plugin-content-docs/client";
import styles from "./PageFacts.module.css";

export default function PageFacts() {
  const { frontMatter: f } = useDoc();
  const rows = [
    ["Type", f.doc_type],
    ["For", f.audience],
    ["Checked against", f.product_version],
    ["Owner", f.owner],
    ["Last review", f.last_review],
  ].filter(([, v]) => v);
  return (
    <dl className={styles.facts}>
      {rows.map(([k, v]) => (
        <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
      ))}
    </dl>
  );
}
