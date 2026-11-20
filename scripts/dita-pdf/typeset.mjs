// Print conventions that Markdown and front matter leave to the publisher, applied to DITA source before it is
// published (scripts/dita-sample.mjs, scripts/dita-pdf/bookmap.mjs):
//   - an apostrophe between letters is the typographic one (’), and a quotation mark is an opening or a closing one
//     (“ ”), in running text: never inside code, a file name, a command, a user-interface label or an attribute;
//   - a simple table is ruled across, top and bottom, rather than boxed on every side.
const CODE = /^(codeblock|codeph|pre|screen|filepath|cmdname|varname|userinput|systemoutput|apiname|parmname|msgph|msgblock|uicontrol|keyword|data)$/;
// A quotation mark at the start of one of these opens a quotation, whatever the text before the element ended with.
const BLOCK = /^(p|li|sli|title|navtitle|mainbooktitle|booktitlealt|booklibrary|shortdesc|cmd|info|stepresult|stepxmp|context|result|prereq|postreq|stentry|entry|note|dt|dd|lq|desc|linktext|section|step|substep|choice|fig|row|strow)$/;

export function typeset(xml) {
  let depth = 0, prev = " ";
  return xml.split(/(<[^>]+>)/).map((part) => {
    const tag = /^<(\/?)([\w-]+)[^>]*?(\/?)>$/.exec(part);
    if (tag) {
      if (CODE.test(tag[2]) && !tag[3]) depth += tag[1] ? -1 : 1;
      if (BLOCK.test(tag[2])) prev = " ";
      return part;
    }
    if (part.startsWith("<")) return part;   // a comment, a processing instruction or a DOCTYPE
    if (depth > 0) { if (part) prev = part.slice(-1); return part; }
    const out = part.replace(/(\p{L})'(?=\p{L})/gu, "$1’").replace(/"/g, (q, at, s) => {
      const before = at ? s[at - 1] : prev;
      return /[\s([{‘“—–/-]/.test(before) ? "“" : "”";
    });
    if (out) prev = out.slice(-1);
    return out;
  }).join("").replace(/<simpletable(?![^>]*\bframe=)/g, '<simpletable frame="topbot"');
}
