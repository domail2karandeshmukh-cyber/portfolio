// Wraps every Markdown table in a region that a keyboard user can focus and scroll.
import React from "react";
import MDXComponents from "@theme-original/MDXComponents";
import { translate } from "@docusaurus/Translate";

function Table(props) {
  const label = translate({ id: "table.scrollLabel", message: "Table, scrolls sideways" });
  return (
    <div className="w-table" role="region" tabIndex={0} aria-label={label}>
      <table {...props} />
    </div>
  );
}

export default { ...MDXComponents, table: Table };
