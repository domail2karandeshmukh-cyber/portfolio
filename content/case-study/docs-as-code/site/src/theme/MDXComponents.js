// Wraps every Markdown table in a region that a keyboard user can focus and scroll. The region is named after the
// table's column headers, so two tables on one page don't share a name (axe: landmark-unique).
import React from "react";
import MDXComponents from "@theme-original/MDXComponents";
import { translate } from "@docusaurus/Translate";

const text = (n) => (n == null || typeof n === "boolean" ? "" : typeof n === "string" || typeof n === "number" ? String(n)
  : Array.isArray(n) ? n.map(text).join("") : n.props ? text(n.props.children) : "");

function headers(children) {
  const parts = React.Children.toArray(children);
  const head = parts.find((c) => c.type === "thead" || c.props?.mdxType === "thead") || parts[0];
  const row = head && React.Children.toArray(head.props?.children)[0];
  return row ? React.Children.toArray(row.props?.children).map((c) => text(c).trim()).filter(Boolean) : [];
}

function Table(props) {
  const cols = headers(props.children).join(", ");
  const label = cols
    ? translate({ id: "table.scrollLabelNamed", message: "Table: {cols}, scrolls sideways" }, { cols })
    : translate({ id: "table.scrollLabel", message: "Table, scrolls sideways" });
  return (
    <div className="w-table" role="region" tabIndex={0} aria-label={label}>
      <table {...props} />
    </div>
  );
}

export default { ...MDXComponents, table: Table };
