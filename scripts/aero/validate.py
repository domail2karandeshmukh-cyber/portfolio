#!/usr/bin/env python3
"""Checks the CSDB of the fictional ARF-1 training rig (content/aerospace/csdb), layer by layer, and writes a report.

    python3 -I scripts/aero/validate.py [--schemas DIR [--fetch]] [--report FILE]

Layers, in order, for every data module and publication module:
  1. well-formed XML, parsed safely: no external DTD, no entity expansion, no network; a DOCTYPE may declare only
     notations and unparsed entities (the ICN references S1000D needs)
  2. valid against the official S1000D Issue 6 schema named in xsi:noNamespaceSchemaLocation (only with --schemas;
     --fetch downloads the schemas from www.s1000d.org into DIR first. They are used there and never copied into the
     repository or the website: their licence for redistribution was not verified)
  3. identification: the file name agrees with the code, issue and language inside the file
  4. references: data module and publication references, internal references and illustrations resolve
  5. applicability: every assertion names a property of the ACT or CCT, with a value they allow
  6. business rules: the project BREX (content/aerospace/csdb/DMC-ARFRIG-...-022A-D)
What no program decides: technical accuracy and formal approval. The report says so instead of passing them.
"""
import hashlib
import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timezone

from lxml import etree

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CSDB = os.path.join(ROOT, "content", "aerospace", "csdb")
XSI = "{http://www.w3.org/2001/XMLSchema-instance}noNamespaceSchemaLocation"
OFFICIAL = "http://www.s1000d.org/S1000D_6/xml_schema_flat/"
DECL = re.compile(r"<!(ENTITY|NOTATION|ELEMENT|ATTLIST)\b[^>]*>", re.S)
SAFE_ENTITY = re.compile(r'<!ENTITY\s+[A-Za-z_][\w.-]*\s+SYSTEM\s+"[^"%&<]*"\s+NDATA\s+[A-Za-z_][\w.-]*\s*>')
SAFE_NOTATION = re.compile(r'<!NOTATION\s+[A-Za-z_][\w.-]*\s+(SYSTEM\s+"[^"%&<]*"|PUBLIC\s+"[^"%&<]*"(\s+"[^"%&<]*")?)\s*>')
MAX_BYTES = 2 * 1024 * 1024


def doctype_problem(text):
    """None if the DOCTYPE is safe; else why not. External subsets and parsed entities are refused."""
    m = re.search(r"<!DOCTYPE\s+[A-Za-z_][\w.-]*(.*?)>", text, re.S)
    if not m:
        return None
    head = text[m.start():m.start() + 200]
    if re.match(r"<!DOCTYPE\s+[\w.-]+\s+(SYSTEM|PUBLIC)\b", head):
        return "The DOCTYPE names an external DTD. External DTDs are not loaded."
    sub = re.search(r"<!DOCTYPE\s+[\w.-]+\s*\[(.*?)\]\s*>", text, re.S)
    if not sub:
        return None
    body = sub.group(1)
    if "%" in body:
        return "The DOCTYPE declares a parameter entity. Only notations and unparsed entities are allowed."
    for d in DECL.finditer(body):
        s = d.group(0)
        if not (SAFE_ENTITY.fullmatch(s) or SAFE_NOTATION.fullmatch(s)):
            return "The DOCTYPE declares something other than a notation or an unparsed (NDATA) entity: " + s[:80]
    rest = DECL.sub("", re.sub(r"<!--.*?-->", "", body, flags=re.S)).strip()
    if rest:
        return "The DOCTYPE contains text that is not a declaration."
    return None


def parse(path):
    raw = open(path, "rb").read()
    if len(raw) > MAX_BYTES:
        raise ValueError("The file is larger than 2 MB.")
    text = raw.decode("utf-8")
    bad = doctype_problem(text)
    if bad:
        raise ValueError(bad)
    parser = etree.XMLParser(resolve_entities=False, no_network=True, load_dtd=False, huge_tree=False, remove_blank_text=False)
    return etree.fromstring(raw, parser, base_url=path).getroottree()


def attr_code(dmc):
    a = dmc.attrib
    return (f'DMC-{a["modelIdentCode"]}-{a["systemDiffCode"]}-{a["systemCode"]}-{a["subSystemCode"]}{a["subSubSystemCode"]}-'
            f'{a["assyCode"]}-{a["disassyCode"]}{a["disassyCodeVariant"]}-{a["infoCode"]}{a["infoCodeVariant"]}-{a["itemLocationCode"]}')


def pm_code(p):
    a = p.attrib
    return f'PMC-{a["modelIdentCode"]}-{a["pmIssuer"]}-{a["pmNumber"]}-{a["pmVolume"]}'


def finding(level, layer, msg, line=None, fix=None):
    f = {"level": level, "layer": layer, "message": msg}
    if line:
        f["line"] = line
    if fix:
        f["fix"] = fix
    return f

# ---------------------------------------------------------------- Schemas


def fetch_schemas(names, folder):
    """Downloads each schema and every schema it includes or imports. Returns {file: {url, sha256, bytes}}."""
    os.makedirs(folder, exist_ok=True)
    todo, done = [OFFICIAL + n for n in sorted(names)], {}
    while todo:
        url = todo.pop()
        name = url.rsplit("/", 1)[1]
        if name in done:
            continue
        path = os.path.join(folder, name)
        if not os.path.exists(path):
            req = urllib.request.Request(url, headers={"User-Agent": "karandeshmukh.dev CSDB check"})
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            open(path, "wb").write(data)
        data = open(path, "rb").read()
        done[name] = {"url": url, "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)}
        for loc in re.findall(rb'<xs:(?:include|import)[^>]*schemaLocation="([^"]+)"', data):
            loc = loc.decode()
            todo.append(loc if loc.startswith("http") else url.rsplit("/", 1)[0] + "/" + loc)
    return done


def schema_for(folder, cache, loc):
    name = loc.rsplit("/", 1)[1]
    if name not in cache:
        cache[name] = etree.XMLSchema(etree.parse(os.path.join(folder, name)))
    return cache[name]

# ---------------------------------------------------------------- The checks


def check_ident(path, tree):
    out, root = [], tree.getroot()
    name = os.path.basename(path)
    if root.tag == "dmodule":
        dmc = root.find("identAndStatusSection/dmAddress/dmIdent/dmCode")
        iss = root.find("identAndStatusSection/dmAddress/dmIdent/issueInfo")
        lang = root.find("identAndStatusSection/dmAddress/dmIdent/language")
        code = attr_code(dmc)
    elif root.tag == "pm":
        dmc = root.find("identAndStatusSection/pmAddress/pmIdent/pmCode")
        iss = root.find("identAndStatusSection/pmAddress/pmIdent/issueInfo")
        lang = root.find("identAndStatusSection/pmAddress/pmIdent/language")
        code = pm_code(dmc)
    else:
        return [finding("error", "ident", f"The root element is <{root.tag}>, not <dmodule> or <pm>.")], None
    want = f'{code}_{iss.get("issueNumber")}-{iss.get("inWork")}_{lang.get("languageIsoCode").upper()}-{lang.get("countryIsoCode")}.XML'
    if name != want:
        out.append(finding("error", "ident", f"The file name does not agree with the identification inside the file. Expected {want}.", dmc.sourceline,
                           "Rename the file, or correct the code, issue or language in the identification."))
    status = root.find("identAndStatusSection/dmStatus") if root.tag == "dmodule" else root.find("identAndStatusSection/pmStatus")
    it, num = status.get("issueType"), int(iss.get("issueNumber"))
    if it == "new" and num > 1:
        out.append(finding("warning", "ident", f"Issue type is new but the issue number is {num:03d}.", status.sourceline))
    if it == "changed" and num == 1:
        out.append(finding("error", "ident", "Issue type is changed but this is issue 001.", status.sourceline))
    if it == "changed" and root.find("identAndStatusSection/*/reasonForUpdate") is None:
        out.append(finding("error", "ident", "A changed module needs a reasonForUpdate.", status.sourceline))
    d = root.find("identAndStatusSection/*/*/issueDate")
    try:
        datetime(int(d.get("year")), int(d.get("month")), int(d.get("day")))
    except (TypeError, ValueError):
        out.append(finding("error", "ident", "The issue date is not a real date.", d.sourceline if d is not None else None))
    return out, (code, iss.get("issueNumber"), iss.get("inWork"))


def check_refs(tree, inventory, path, ident=None):
    out, root = [], tree.getroot()
    latest_self = ident is None or max(inventory.get(ident[0], {(ident[1], ident[2])})) == (ident[1], ident[2])
    ids = set(root.xpath("//@id"))
    for r in root.iter("internalRef"):
        if r.get("internalRefId") not in ids:
            out.append(finding("error", "refs", f'internalRef points to "{r.get("internalRefId")}", which is not in this module.', r.sourceline))
    for a in ("nextActionRefId",):
        for e in root.xpath(f"//*[@{a}]"):
            if e.get(a) not in ids:
                out.append(finding("error", "refs", f'{e.tag} points to step "{e.get(a)}", which is not in this module.', e.sourceline))
    for e in root.xpath("//*[@applicRefId]"):
        if e.get("applicRefId") not in ids:
            out.append(finding("error", "refs", f'applicRefId "{e.get("applicRefId")}" has no applic annotation in this module.', e.sourceline))
    for dm in root.iter("dmRef"):
        c = dm.find("dmRefIdent/dmCode")
        if c is None:
            continue
        code = attr_code(c)
        if c.get("modelIdentCode") == "S1000D":
            continue  # the S1000D default BREX: referred to, not held in this CSDB
        issue = dm.find("dmRefIdent/issueInfo")
        held = inventory.get(code)
        if not held:
            out.append(finding("error", "refs", f"dmRef points to {code}, which is not in the CSDB.", dm.sourceline))
        elif issue is not None and (issue.get("issueNumber"), issue.get("inWork")) not in held:
            out.append(finding("error", "refs", f'dmRef points to issue {issue.get("issueNumber")}-{issue.get("inWork")} of {code}, which is not in the CSDB.', dm.sourceline))
        elif issue is not None and max(held) > (issue.get("issueNumber"), issue.get("inWork")) and root.tag == "pm" and latest_self:
            latest = max(held)
            out.append(finding("warning", "refs", f"This publication contains issue {issue.get('issueNumber')} of {code}. Issue {latest[0]} is the latest.", dm.sourceline,
                               "Make a new issue of the publication that refers to the latest issue, if the change applies to its readers."))
    docinfo = tree.docinfo
    ents = {}
    if docinfo.internalDTD is not None:
        for e in docinfo.internalDTD.iterentities():
            ents[e.name] = e.system_url
    for g in root.iter("graphic"):
        icn = g.get("infoEntityIdent")
        if icn not in ents:
            out.append(finding("error", "refs", f"graphic refers to {icn}, which the DOCTYPE does not declare.", g.sourceline,
                               f'Declare <!ENTITY {icn} SYSTEM "{icn}.SVG" NDATA svg> in the DOCTYPE.'))
        elif not os.path.exists(os.path.join(os.path.dirname(path), ents[icn])):
            out.append(finding("error", "refs", f"The illustration file {ents[icn]} is not in the CSDB.", g.sourceline))
    return out


def load_applic(trees):
    act = cct = None
    for t in trees.values():
        r = t.getroot()
        if r.find("content/applicCrossRefTable") is not None:
            act = r
        if r.find("content/condCrossRefTable") is not None:
            cct = r
    props = {}

    def values(node):
        vals, pattern = set(), node.get("valuePattern")
        for en in node.iter("enumeration"):
            for v in en.get("applicPropertyValues", "").split("|"):
                vals.add(v)
        return vals, pattern
    if act is not None:
        for p in act.iter("productAttribute"):
            props[("prodattr", p.get("id"))] = values(p)
    if cct is not None:
        types = {t.get("id"): values(t) for t in cct.iter("condType")}
        for c in cct.iter("cond"):
            props[("condition", c.get("id"))] = types.get(c.get("condTypeRefId"), (set(), None))
    return props


def check_applic(tree, props):
    out = []
    for a in tree.getroot().iter("assert"):
        key = (a.get("applicPropertyType"), a.get("applicPropertyIdent"))
        if key not in props:
            out.append(finding("error", "applic", f'assert names {key[0]} "{key[1]}", which the ACT and CCT do not define.', a.sourceline))
            continue
        allowed, pattern = props[key]
        for v in re.split(r"[|~]", a.get("applicPropertyValues", "")):
            if allowed and v not in allowed:
                out.append(finding("error", "applic", f'"{v}" is not a value of {key[1]}. Allowed: {", ".join(sorted(allowed))}.', a.sourceline))
            elif pattern and not re.fullmatch(pattern, v):
                out.append(finding("error", "applic", f'"{v}" does not match the pattern {pattern} of {key[1]}.', a.sourceline))
    for p in tree.getroot().iter("assign"):
        key = (p.get("applicPropertyType"), p.get("applicPropertyIdent"))
        if key not in props:
            out.append(finding("error", "applic", f'The product assigns {key[0]} "{key[1]}", which the ACT and CCT do not define.', p.sourceline))
    return out


def check_brex(tree, brex):
    out, root = [], tree.getroot()
    for rule in brex.iter("structureObjectRule"):
        op = rule.find("objectPath")
        flag, path, use = op.get("allowedObjectFlag"), op.text.strip(), (rule.findtext("objectUse") or "").strip()
        try:
            res = root.xpath(path)
        except etree.XPathError as e:
            out.append(finding("error", "brex", f"The BREX rule {path} is not valid XPath: {e}"))
            continue
        nodes = res if isinstance(res, list) else []
        if flag == "0" and (nodes or res is True):
            for n in nodes[:5]:
                line = n.getparent().sourceline if isinstance(n, etree._ElementUnicodeResult) and n.getparent() is not None else getattr(n, "sourceline", None)
                out.append(finding("error", "brex", use, line, f"Rule: {path}"))
        elif flag == "1" and not nodes and res is not True:
            out.append(finding("error", "brex", use, None, f"Rule: {path}"))
        allowed = [v.get("valueAllowed") for v in rule.findall("objectValue")]
        if allowed and nodes:
            for n in nodes:
                val = str(n) if isinstance(n, str) else (n.text or "")
                if not any(v == val or ("~" in v and v.split("~")[0] <= val <= v.split("~")[1]) for v in allowed):
                    line = n.getparent().sourceline if isinstance(n, etree._ElementUnicodeResult) and n.getparent() is not None else getattr(n, "sourceline", None)
                    out.append(finding("error", "brex", f'"{val}" is not allowed. {use}', line, f"Allowed: {', '.join(allowed)}"))
    # The SNS of every data module must be one the BREX describes.
    sns = {(s.findtext("snsCode")) for s in brex.iter("snsSystem")}
    dmc = root.find("identAndStatusSection/dmAddress/dmIdent/dmCode")
    if dmc is not None and sns and dmc.get("systemCode") not in sns:
        out.append(finding("error", "brex", f'System code {dmc.get("systemCode")} is not in the project SNS ({", ".join(sorted(sns))}).', dmc.sourceline))
    return out


def main(argv):
    schemas = report_path = None
    fetch = "--fetch" in argv
    if "--schemas" in argv:
        schemas = argv[argv.index("--schemas") + 1]
    if "--report" in argv:
        report_path = argv[argv.index("--report") + 1]
    files = sorted(f for f in os.listdir(CSDB) if f.endswith(".XML"))
    trees, results, inventory = {}, {}, {}
    for f in files:
        try:
            trees[f] = parse(os.path.join(CSDB, f))
            results[f] = [finding("pass", "wellformed", "Well-formed. Parsed with external DTDs, entity expansion and the network turned off.")]
        except (etree.XMLSyntaxError, ValueError, UnicodeDecodeError) as e:
            results[f] = [finding("error", "wellformed", str(e), getattr(e, "lineno", None))]
    idents = {}
    for f, t in trees.items():
        found, ident = check_ident(os.path.join(CSDB, f), t)
        results[f] += found
        idents[f] = ident
        if ident:
            inventory.setdefault(ident[0], set()).add((ident[1], ident[2]))
    schema_info = None
    if schemas:
        names = {t.getroot().get(XSI, "").rsplit("/", 1)[-1] for t in trees.values()}
        if fetch:
            schema_info = fetch_schemas(names, schemas)
        cache = {}
        for f, t in trees.items():
            loc = t.getroot().get(XSI, "")
            if not loc.startswith(OFFICIAL):
                results[f].append(finding("error", "schema", f"The schema location {loc} is not an official S1000D Issue 6 schema."))
                continue
            xsd = schema_for(schemas, cache, loc)
            if xsd.validate(t):
                results[f].append(finding("pass", "schema", f"Valid against {loc.rsplit('/', 1)[1]} (S1000D Issue 6)."))
            else:
                for e in xsd.error_log:
                    results[f].append(finding("error", "schema", e.message, e.line))
    brex = next((t.getroot() for t in trees.values() if t.getroot().find("content/brex") is not None), None)
    props = load_applic(trees)
    for f, t in trees.items():
        results[f] += check_refs(t, inventory, os.path.join(CSDB, f), idents.get(f))
        results[f] += check_applic(t, props)
        if brex is not None and t.getroot() is not brex:
            results[f] += check_brex(t, brex)
        for layer in ("refs", "applic", "brex"):
            if not any(x["layer"] == layer and x["level"] in ("error", "warning") for x in results[f]):
                results[f].append(finding("pass", layer, {"refs": "Every reference resolves.", "applic": "Every applicability assertion uses a defined property and value.",
                                                          "brex": "No project business rule is broken."}[layer]))
        results[f].append(finding("human", "review", "Technical accuracy and formal approval need a qualified person. No program checks them."))
    errors = sum(1 for r in results.values() for x in r if x["level"] == "error")
    warnings = sum(1 for r in results.values() for x in r if x["level"] == "warning")
    report = {
        "checked": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "issue": "S1000D Issue 6",
        "libxml2": ".".join(map(str, etree.LIBXML_VERSION)),
        "schemas": schema_info or ("checked" if schemas else "not checked (no --schemas)"),
        "files": len(files), "errors": errors, "warnings": warnings,
        "results": results,
    }
    for f, r in results.items():
        bad = [x for x in r if x["level"] in ("error", "warning")]
        print(f"{'FAIL' if any(x['level'] == 'error' for x in bad) else 'ok  '} {f}")
        for x in bad:
            print(f"     {x['level']} [{x['layer']}] line {x.get('line', '-')}: {x['message']}")
    print(f"{len(files)} files, {errors} error(s), {warnings} warning(s); schema layer: {'on' if schemas else 'off'}")
    if report_path:
        with open(report_path, "w", encoding="utf-8") as fh:
            json.dump(report, fh, indent=1)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
