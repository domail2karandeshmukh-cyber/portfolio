#!/usr/bin/env python3
"""Writes the common source database (CSDB) of the fictional ARF-1 training rig to content/aerospace/csdb:
S1000D Issue 6 data modules, two publication modules, the project BREX and the applicability tables.

The rig, its parts, part numbers and values are invented for a portfolio demonstration. Nothing here is
approved maintenance data, and nothing is taken from a real manual.

    python3 -I scripts/aero/csdb.py

Issue 001 of each module is the first release (2 November 2026), and knows nothing of Modification M01.
Engineering change EC-ARF-01 (Modification M01: two quick-release latches replace the four fan mounting screws,
16 November 2026) added the conditions cross-reference table that defines M01, and made issue 002 of the ACT
(which now refers to it), the PCT (which records M01 for each serial number), the description, the remove and
install procedures, the illustrated parts data and both publications. Both issues are kept, so the CSDB shows
the history, and each publication issue is a baseline: it names the exact issue of every module it contains.
No module records a verification: nobody qualified has checked this fictional content, so each is unverified.
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, "content", "aerospace", "csdb")
MIC, SDC, ISSUER = "ARFRIG", "A", "0DEMO"
SCHEMA = "http://www.s1000d.org/S1000D_6/xml_schema_flat/"
NS = ('xmlns:dc="http://www.purl.org/dc/elements/1.1/" xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" '
      'xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"')
TEAM = "Documentation Studio demonstration team (fictional)"
D1, D2 = ("2026", "11", "02"), ("2026", "11", "16")
RFU = "rfu-0001"


def code(sys_="00", sub="0", subsub="0", assy="00", dis="00", disv="A", ic="040", icv="A", ilc="D"):
    return dict(sys=sys_, sub=sub, subsub=subsub, assy=assy, dis=dis, disv=disv, ic=ic, icv=icv, ilc=ilc)


def dmcode(c):
    return (f'<dmCode modelIdentCode="{MIC}" systemDiffCode="{SDC}" systemCode="{c["sys"]}" subSystemCode="{c["sub"]}" '
            f'subSubSystemCode="{c["subsub"]}" assyCode="{c["assy"]}" disassyCode="{c["dis"]}" disassyCodeVariant="{c["disv"]}" '
            f'infoCode="{c["ic"]}" infoCodeVariant="{c["icv"]}" itemLocationCode="{c["ilc"]}"/>')


def dmc_text(c):
    return f'DMC-{MIC}-{SDC}-{c["sys"]}-{c["sub"]}{c["subsub"]}-{c["assy"]}-{c["dis"]}{c["disv"]}-{c["ic"]}{c["icv"]}-{c["ilc"]}'


def dmref(c, issue=None, title=None):
    ident = dmcode(c) + (f'<issueInfo issueNumber="{issue}" inWork="00"/><language languageIsoCode="en" countryIsoCode="US"/>' if issue else "")
    items = f"<dmRefAddressItems><dmTitle><techName>{title[0]}</techName><infoName>{title[1]}</infoName></dmTitle></dmRefAddressItems>" if title else ""
    return f"<dmRef><dmRefIdent>{ident}</dmRefIdent>{items}</dmRef>"


# The modules of the CSDB, by role.
BREX = code(ic="022")
ACT, CCT, PCT = code(ic="00W"), code(ic="00Q"), code(ic="00P")
DESCR = code(ic="040")
OPER = code(ic="131", ilc="A")
REMOVE = code(sys_="20", ic="520", ilc="A")
INSTALL = code(sys_="20", ic="720", ilc="A")
FILTER = code(sys_="30", ic="310", ilc="A")
ADJUST = code(sys_="20", ic="271", ilc="A")
TEST = code(sys_="20", ic="340", ilc="A")
FAULT = code(sys_="20", ic="421", ilc="A")
IPD = code(ic="941")

TITLES = {
    "022": ("ARF-1 training rig", "Business rules exchange"),
    "00W": ("ARF-1 training rig", "Applicability cross-reference table"),
    "00Q": ("ARF-1 training rig", "Conditions cross-reference table"),
    "00P": ("ARF-1 training rig", "Product cross-reference table"),
    "040": ("Training rig", "Description"),
    "131": ("Training rig", "Normal operation procedure"),
    "520": ("Fan assembly", "Remove procedure"),
    "720": ("Fan assembly", "Install procedure"),
    "310": ("Air filter", "Visual examination"),
    "271": ("Fan speed", "Adjust"),
    "340": ("Fan assembly", "Function test"),
    "421": ("Fan does not run", "Fault isolation procedure"),
    "941": ("Training rig", "Illustrated parts data"),
}
SCHEMAS = {"022": "brex", "00W": "appliccrossreftable", "00Q": "condcrossreftable", "00P": "prdcrossreftable", "040": "descript",
           "131": "proced", "520": "proced", "720": "proced", "310": "proced", "271": "proced", "340": "proced", "421": "fault", "941": "ipd"}

RESTRICT = (
    "<dataRestrictions><restrictionInstructions>"
    "<dataDistribution>Demonstration data for a fictional training rig. Not approved maintenance data. Do not use on real equipment.</dataDistribution>"
    "</restrictionInstructions><restrictionInfo><copyright><copyrightPara>Original demonstration content written by Karan Deshmukh for a portfolio, 2026. "
    "The rig, part numbers, values and codes are invented.</copyrightPara></copyright></restrictionInfo></dataRestrictions>"
)


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def doctype(root, icns):
    if not icns:
        return f"<!DOCTYPE {root}>"
    ents = "".join(f'\n<!ENTITY {i} SYSTEM "{i}.SVG" NDATA svg>' for i in icns)
    return f'<!DOCTYPE {root} [\n<!NOTATION svg SYSTEM "svg">{ents}\n]>'


def dmodule(c, issue, content, *, date=D1, icns=(), applic="All", qa=None, changed=False, rfu=None, remarks=None):
    """A data module: identification and status, then the content as given."""
    ic = c["ic"]
    tech, info = TITLES[ic]
    issue_type = "changed" if changed else "new"
    qa_xml = "<unverified/>" if qa is None else f'<firstVerification verificationType="{qa}"/>'
    act_ref = "" if ic in ("022", "00W", "00Q", "00P") else f"<applicCrossRefTableRef>{dmref(ACT)}</applicCrossRefTableRef>"
    rfu_xml = f'<reasonForUpdate id="{RFU}" updateHighlight="1" updateReasonType="urt02"><simplePara>{esc(rfu)}</simplePara></reasonForUpdate>' if rfu else ""
    rem = f"<remarks><simplePara>{esc(remarks)}</simplePara></remarks>" if remarks else ""
    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
{doctype("dmodule", icns)}
<dmodule {NS} xsi:noNamespaceSchemaLocation="{SCHEMA}{SCHEMAS[ic]}.xsd">
<identAndStatusSection>
<dmAddress>
<dmIdent>
{dmcode(c)}
<language languageIsoCode="en" countryIsoCode="US"/>
<issueInfo issueNumber="{issue}" inWork="00"/>
</dmIdent>
<dmAddressItems>
<issueDate year="{date[0]}" month="{date[1]}" day="{date[2]}"/>
<dmTitle><techName>{esc(tech)}</techName><infoName>{esc(info)}</infoName></dmTitle>
</dmAddressItems>
</dmAddress>
<dmStatus issueType="{issue_type}">
<security securityClassification="01"/>
{RESTRICT}
<responsiblePartnerCompany><enterpriseName>{TEAM}</enterpriseName></responsiblePartnerCompany>
<originator><enterpriseName>{TEAM}</enterpriseName></originator>
{act_ref}
<applic><displayText><simplePara>{esc(applic)}</simplePara></displayText></applic>
<brexDmRef>{dmref(BREX)}</brexDmRef>
<qualityAssurance>{qa_xml}</qualityAssurance>
{rfu_xml}
{rem}
</dmStatus>
</identAndStatusSection>
{content.strip()}
</dmodule>
"""
    name = f'{dmc_text(c)}_{issue}-00_EN-US.XML'
    return name, "\n".join(line for line in xml.split("\n") if line.strip() != "")


def ch(kind):
    """Change markup for issue 002: kind is add or modify."""
    return f' changeType="{kind}" changeMark="1" reasonForUpdateRefIds="{RFU}"'


APPLIC_M01 = """<referencedApplicGroup>
<applic id="app-pre-m01"><displayText><simplePara>Before Modification M01</simplePara></displayText>
<assert applicPropertyIdent="M01" applicPropertyType="condition" applicPropertyValues="pre"/></applic>
<applic id="app-post-m01"><displayText><simplePara>After Modification M01</simplePara></displayText>
<assert applicPropertyIdent="M01" applicPropertyType="condition" applicPropertyValues="post"/></applic>
</referencedApplicGroup>"""

APPLIC_VARIANT = """<applic id="app-classroom"><displayText><simplePara>Classroom variant</simplePara></displayText>
<assert applicPropertyIdent="variant" applicPropertyType="prodattr" applicPropertyValues="Classroom"/></applic>
<applic id="app-workshop"><displayText><simplePara>Workshop variant</simplePara></displayText>
<assert applicPropertyIdent="variant" applicPropertyType="prodattr" applicPropertyValues="Workshop"/></applic>"""

WARN_POWER = ("<warning><warningAndCautionPara>Disconnect the bench power supply before you touch the fan assembly. "
              "The fan blades can turn and cause injury to your fingers.</warningAndCautionPara></warning>")


def steps(items, start=1):
    """Procedural steps from (text, extra) pairs; extra is XML put before the paragraph, or attributes.
    A step keeps its id from issue to issue: a step added by a later issue gives its own ("id"), the next number
    not used before, so the steps around it keep theirs."""
    out, n = [], start
    for it in items:
        if isinstance(it, str):
            it = {"t": it}
        if "id" in it:
            sid = it["id"]
        else:
            sid, n = f"stp-{n:04d}", n + 1
        attrs = f' id="{sid}"' + it.get("a", "")
        out.append(f"<proceduralStep{attrs}>{it.get('pre', '')}<para>{it['t']}</para>{it.get('post', '')}</proceduralStep>")
    return "\n".join(out)


def figure(fid, title, icn, attrs="", hotspots=""):
    return f'<figure id="{fid}"{attrs}><title>{esc(title)}</title><graphic infoEntityIdent="{icn}">{hotspots}</graphic></figure>'


def iref(target, kind):
    return f'<internalRef internalRefId="{target}" internalRefTargetType="{kind}"/>'


ICN = {
    "general": "ICN-0DEMO-ARF0001-001-01",
    "fan-screws": "ICN-0DEMO-ARF0002-001-01",
    "filter": "ICN-0DEMO-ARF0003-001-01",
    "ipd-1": "ICN-0DEMO-ARF0004-001-01",
    "ipd-2": "ICN-0DEMO-ARF0004-002-01",
    "fan-latches": "ICN-0DEMO-ARF0005-001-01",
    "control": "ICN-0DEMO-ARF0006-001-01",
}

# ---------------------------------------------------------------- The applicability tables and the BREX


def act(issue):
    """The ACT. Issue 002 (EC-ARF-01) refers to the new CCT, where condition M01 is defined."""
    two = issue == "002"
    cct_ref = f"<condCrossRefTableRef>{dmref(CCT)}</condCrossRefTableRef>" if two else ""
    content = f"""<content>
<applicCrossRefTable>
<productAttributeList>
<productAttribute id="model">
<name>Model</name>
<displayName>Model</displayName>
<descr>The model of the training rig.</descr>
<enumeration applicPropertyValues="ARF-1"/>
</productAttribute>
<productAttribute id="serialNumber" valuePattern="[0-9]{{3}}">
<name>Serial number</name>
<displayName>Serial number</displayName>
<descr>The serial number on the identification plate of the frame.</descr>
</productAttribute>
<productAttribute id="variant">
<name>Variant</name>
<displayName>Variant</displayName>
<descr>The build of the rig. The classroom variant has a transparent access panel. The workshop variant has a metal access panel.</descr>
<enumeration applicPropertyValues="Classroom|Workshop"/>
</productAttribute>
</productAttributeList>
{cct_ref}
<productCrossRefTableRef>{dmref(PCT)}</productCrossRefTableRef>
</applicCrossRefTable>
</content>"""
    if two:
        return dmodule(ACT, "002", content, date=D2, changed=True,
                       rfu="EC-ARF-01: the ACT now refers to the conditions cross-reference table, which defines Modification M01.")
    return dmodule(ACT, "001", content)


def cct():
    """The CCT is new with EC-ARF-01: before the change, the rig had no conditions."""
    content = """<content>
<condCrossRefTable>
<condTypeList>
<condType id="cdt-mod">
<name>Modification status</name>
<descr>Whether a modification is incorporated in the rig.</descr>
<enumeration applicPropertyValues="pre|post"/>
</condType>
</condTypeList>
<condList>
<cond id="M01" condTypeRefId="cdt-mod">
<name>Modification M01</name>
<descr>Two quick-release latches replace the four fan mounting screws. Introduced by engineering change EC-ARF-01.</descr>
</cond>
</condList>
</condCrossRefTable>
</content>"""
    return dmodule(CCT, "001", content, date=D2,
                   remarks="Made by engineering change EC-ARF-01 to define Modification M01. The rig had no conditions before.")


PRODUCTS = [("001", "Classroom", "pre"), ("002", "Classroom", "post"), ("003", "Workshop", "post")]


def pct(issue):
    """The PCT: each serial number of the rig and its attributes. Issue 002 (EC-ARF-01) records whether M01 is incorporated."""
    two = issue == "002"
    rows = []
    for sn, variant, m01 in PRODUCTS:
        mod = f'\n<assign applicPropertyIdent="M01" applicPropertyType="condition" applicPropertyValue="{m01}"/>' if two else ""
        rows.append(f"""<product id="prd-sn{sn}">
<assign applicPropertyIdent="model" applicPropertyType="prodattr" applicPropertyValue="ARF-1"/>
<assign applicPropertyIdent="serialNumber" applicPropertyType="prodattr" applicPropertyValue="{sn}"/>
<assign applicPropertyIdent="variant" applicPropertyType="prodattr" applicPropertyValue="{variant}"/>{mod}
</product>""")
    content = "<content>\n<productCrossRefTable>\n" + "\n".join(rows) + "\n</productCrossRefTable>\n</content>"
    if two:
        return dmodule(PCT, "002", content, date=D2, changed=True,
                       rfu="EC-ARF-01: each serial number now records Modification M01: not incorporated (pre) on 001, incorporated (post) on 002 and 003.")
    return dmodule(PCT, "001", content)


BREX_RULES = [
    # (flag, path, use, values)
    ("2", "//@securityClassification", "Only unclassified data (01) is allowed in this project.", [("01", "Unclassified")]),
    ("2", "//dmCode/@modelIdentCode|//pmCode/@modelIdentCode", "The model identification code of the project is ARFRIG.", [("ARFRIG", "ARF-1 training rig")]),
    ("2", "//dmIdent/dmCode/@infoCode", "The project uses these information codes only.",
     [("022", "BREX"), ("00W", "ACT"), ("00Q", "CCT"), ("00P", "PCT"), ("040", "Description"), ("131", "Normal operation procedure"),
      ("271", "Adjust"), ("310", "Visual examination"), ("340", "Function test"), ("421", "Fault isolation procedure"),
      ("520", "Remove procedure"), ("720", "Install procedure"), ("941", "Illustrated parts data")]),
    ("2", "//@emphasisType", "Bold (em01) is the only emphasis in this project.", [("em01", "Bold")]),
    ("2", "//@updateReasonType", "A reason for update is editorial, technical or about applicability.",
     [("urt01", "Editorial change"), ("urt02", "Technical change"), ("urt04", "Applicability change")]),
    ("0", "//dmStatus[not(dataRestrictions/restrictionInstructions/dataDistribution)]",
     "Every data module carries the demonstration statement in dataDistribution.", []),
    ("0", "//dmStatus[not(applicCrossRefTableRef)][not(ancestor::dmodule/content/brex or ancestor::dmodule/content/applicCrossRefTable or ancestor::dmodule/content/condCrossRefTable or ancestor::dmodule/content/productCrossRefTable)]",
     "Every data module except the BREX and the applicability tables refers to the project ACT.", []),
    ("0", "//brexDmRef/dmRef/dmRefIdent/dmCode[not(@modelIdentCode='ARFRIG' and @infoCode='022')][not(ancestor::dmodule/content/brex)]",
     "Data modules refer to the project BREX, not to the default BREX.", []),
    ("0", "//proceduralStep[count(ancestor::proceduralStep) > 2]", "Procedural steps go no deeper than three levels.", []),
    ("0", "//proceduralStep/para[string-length(normalize-space(.)) > 180]", "A step paragraph has one short instruction. Split long steps.", []),
    ("0", "//warning[not(ancestor::reqSafety) and not(parent::proceduralStep)]", "Warnings are in the safety requirements or at the start of the step they apply to.", []),
    ("0", "//figure[not(title)]", "Every figure has a title.", []),
    ("0", "//*[@applicRefId][not(@applicRefId = //applic/@id)]", "Every applicability reference points to an annotation in this module.", []),
    ("0", "//assert[@applicPropertyType='condition'][@applicPropertyValues != 'pre' and @applicPropertyValues != 'post']",
     "A modification is a condition with the value pre (not incorporated) or post (incorporated).", []),
    ("0", "//assert[@applicPropertyType='prodattr'][not(@applicPropertyIdent='model' or @applicPropertyIdent='serialNumber' or @applicPropertyIdent='variant')]",
     "Product attributes are model, serialNumber and variant, as defined in the ACT.", []),
    ("0", "//graphic[not(starts-with(@infoEntityIdent, 'ICN-0DEMO-'))]", "Illustrations use the project ICN prefix ICN-0DEMO-.", []),
]

SNS = [("00", "General"), ("10", "Frame and access panel"), ("20", "Fan assembly"), ("30", "Air filter"), ("40", "Control box")]


def brex():
    rules = []
    for flag, path, use, values in BREX_RULES:
        vals = "".join(f'<objectValue valueForm="single" valueAllowed="{v}">{esc(t)}</objectValue>' for v, t in values)
        rules.append(f'<structureObjectRule><objectPath allowedObjectFlag="{flag}">{esc(path)}</objectPath><objectUse>{esc(use)}</objectUse>{vals}</structureObjectRule>')
    sns = "".join(
        f"<snsSystem><snsCode>{c}</snsCode><snsTitle>{t}</snsTitle><snsSubSystem><snsCode>0</snsCode><snsTitle>{t}</snsTitle>"
        f"<snsSubSubSystem><snsCode>0</snsCode><snsTitle>{t}</snsTitle><snsAssy><snsCode>00</snsCode><snsTitle>{t}</snsTitle></snsAssy>"
        f"</snsSubSubSystem></snsSubSystem></snsSystem>" for c, t in SNS)
    content = f"""<content>
<brex>
<commonInfo><para>Project business rules for the fictional ARF-1 training rig. These rules add to the S1000D Issue 6 default BREX
(DMC-S1000D-H-04-10-0301-00A-022A-D), which is not copied here.</para></commonInfo>
<snsRules><snsDescr>{sns}</snsDescr></snsRules>
<contextRules>
<structureObjectRuleGroup>
{chr(10).join(rules)}
</structureObjectRuleGroup>
<notationRuleList><notationRule><notationName allowedNotationFlag="1">svg</notationName><objectUse>Illustrations are SVG.</objectUse></notationRule></notationRuleList>
</contextRules>
</brex>
</content>"""
    # The project BREX refers to the S1000D default BREX for Issue 6.
    name, xml = dmodule(BREX, "001", content)
    default = ('<dmCode modelIdentCode="S1000D" systemDiffCode="H" systemCode="04" subSystemCode="1" subSubSystemCode="0" assyCode="0301" '
               'disassyCode="00" disassyCodeVariant="A" infoCode="022" infoCodeVariant="A" itemLocationCode="D"/>')
    xml = xml.replace(f"<brexDmRef>{dmref(BREX)}</brexDmRef>", f"<brexDmRef><dmRef><dmRefIdent>{default}</dmRefIdent></dmRef></brexDmRef>")
    return name, xml

# ---------------------------------------------------------------- Description


def description(issue):
    two = issue == "002"
    fan = ("<para>Four screws and four washers attach the fan assembly to the frame. A connector connects the fan assembly to the control box.</para>"
           if not two else
           f'<para applicRefId="app-pre-m01"{ch("modify")}>Before Modification M01, four screws and four washers attach the fan assembly to the frame.</para>'
           f'<para applicRefId="app-post-m01"{ch("add")}>After Modification M01, two quick-release latches attach the fan assembly to the frame. You do not need tools to open the latches.</para>'
           "<para>A connector connects the fan assembly to the control box.</para>")
    latch_row = (f'<row{ch("add")}><entry><para>Latch operation (after Modification M01)</para></entry><entry><para>By hand, no tools</para></entry></row>' if two else "")
    torque_row = (f'<row{ch("modify")}><entry><para>Torque, fan mounting screws (before Modification M01)</para></entry><entry><para>2.5 N.m</para></entry></row>' if two else
                  "<row><entry><para>Torque, fan mounting screws</para></entry><entry><para>2.5 N.m</para></entry></row>")
    content = f"""<content>
{APPLIC_M01 if two else ""}
<description>
<levelledPara id="par-0001">
<title>General</title>
<para>The ARF-1 training rig is a bench-mounted device for maintenance training. It has an air recirculation fan, an air filter and a control box.</para>
<para>Students use the rig to practice removal, installation, examination, adjustment and fault isolation tasks. The rig does not represent a specific aircraft.</para>
</levelledPara>
<levelledPara id="par-0002">
<title>Main components</title>
<para>Refer to {iref("fig-0001", "irtt01")} for the location of the components.</para>
{figure("fig-0001", "Training rig - general view", ICN["general"])}
<para>The rig has these main components:<randomList>
<listItem><para>The frame and the access panel</para></listItem>
<listItem><para>The fan assembly</para></listItem>
<listItem><para>The air filter</para></listItem>
<listItem><para>The airflow indicator</para></listItem>
<listItem><para>The control box</para></listItem>
</randomList></para>
</levelledPara>
<levelledPara id="par-0003"{ch("modify") if two else ""}>
<title>Fan assembly</title>
<para>The fan assembly pulls air through the air filter. Then it pushes the air through the outlet duct and the airflow indicator.</para>
{fan}
</levelledPara>
<levelledPara id="par-0004">
<title>Air filter</title>
<para>The filter element is in the filter housing. A clamp holds the cover of the filter housing.</para>
<para>A differential pressure indicator is on the filter housing. When the filter element is blocked, the indicator shows a red band.</para>
</levelledPara>
<levelledPara id="par-0005">
<title>Control box</title>
<para>The control box supplies electrical power to the fan assembly. It has these controls and indicators:<randomList>
<listItem><para>Power switch S1</para></listItem>
<listItem><para>Circuit breaker CB1</para></listItem>
<listItem><para>Speed control R1</para></listItem>
<listItem><para>POWER lamp DS1 (green)</para></listItem>
<listItem><para>FAN FAULT lamp DS2 (amber)</para></listItem>
<listItem><para>Test points TP1 and TP2</para></listItem>
</randomList></para>
<para>An adjustment potentiometer R2 inside the control box sets the maximum fan speed.</para>
</levelledPara>
<levelledPara id="par-0006">
<title>Technical data</title>
<para>The values in {iref("tab-0001", "irtt02")} are training values for this fictional rig. Do not use them for other equipment.</para>
<table id="tab-0001">
<title>Training rig - technical data</title>
<tgroup cols="2">
<colspec colname="col1"/><colspec colname="col2"/>
<thead><row><entry><para>Item</para></entry><entry><para>Value</para></entry></row></thead>
<tbody>
<row><entry><para>Supply voltage</para></entry><entry><para>24 V DC, from an external bench power supply</para></entry></row>
<row><entry><para>Fan speed signal at TP1 and TP2, speed control at MAX</para></entry><entry><para>10.0 V DC, tolerance 0.2 V</para></entry></row>
{torque_row}
<row><entry><para>Mass of the fan assembly</para></entry><entry><para>2.4 kg</para></entry></row>
{latch_row}
</tbody>
</tgroup>
</table>
</levelledPara>
</description>
</content>"""
    if two:
        return dmodule(DESCR, "002", content, date=D2, icns=[ICN["general"]], changed=True,
                       rfu="EC-ARF-01: Modification M01 adds two quick-release latches. The fan assembly paragraph and the technical data changed.")
    return dmodule(DESCR, "001", content, icns=[ICN["general"]])

# ---------------------------------------------------------------- Operation (operator information)


def operation():
    support = """<reqSupportEquips><supportEquipDescrGroup>
<supportEquipDescr id="seq-0001"><name>Bench power supply, 24 V DC</name><identNumber><manufacturerCode>0DEMO</manufacturerCode><partAndSerialNumber><partNumber>ARF-GSE-01</partNumber></partAndSerialNumber></identNumber><reqQuantity>1</reqQuantity></supportEquipDescr>
</supportEquipDescrGroup></reqSupportEquips>"""
    start = steps([
        "Make sure that the access panel is closed.",
        f"Connect the bench power supply {iref('seq-0001', 'irtt05')} to the power connector of the control box.",
        "Set the speed control R1 to MIN.",
        "Set the power switch S1 to ON.",
        "Make sure that the POWER lamp DS1 comes on.",
        "Turn the speed control R1 clockwise until the pointer of the airflow indicator is in the green band.",
        "Make sure that the FAN FAULT lamp DS2 is off.",
    ])
    stop = steps(["Set the speed control R1 to MIN.", "Set the power switch S1 to OFF.", "Disconnect the bench power supply."], start=10)
    content = f"""<content>
<procedure>
<preliminaryRqmts>
<reqCondGroup><reqCondNoRef><reqCond>The rig is on a stable bench.</reqCond></reqCondNoRef></reqCondGroup>
{support}
<reqSupplies><noSupplies/></reqSupplies>
<reqSpares><noSpares/></reqSpares>
<reqSafety><safetyRqmts>{WARN_POWER.replace("Disconnect the bench power supply before you touch the fan assembly.", "Keep the access panel closed when the fan operates.")}</safetyRqmts></reqSafety>
</preliminaryRqmts>
<mainProcedure>
<proceduralStep id="stp-0100"><title>Start the rig</title><para>Do the steps that follow.</para>
{start}
</proceduralStep>
<proceduralStep id="stp-0200"><title>Stop the rig</title><para>Do the steps that follow.</para>
{stop}
</proceduralStep>
</mainProcedure>
<closeRqmts><reqCondGroup><noConds/></reqCondGroup></closeRqmts>
</procedure>
</content>"""
    return dmodule(OPER, "001", content)

# ---------------------------------------------------------------- Remove and install


def remove(issue):
    two = issue == "002"
    figs = (figure("fig-0001", "Fan assembly - removal and installation (before Modification M01)", ICN["fan-screws"], attrs=f' applicRefId="app-pre-m01"{ch("modify")}')
            + figure("fig-0002", "Fan assembly - removal and installation (after Modification M01)", ICN["fan-latches"], attrs=f' applicRefId="app-post-m01"{ch("add")}')
            if two else figure("fig-0001", "Fan assembly - removal and installation", ICN["fan-screws"]))
    fixing = ([{"t": f"Remove the four screws (2) and the four washers (3). Refer to {iref('fig-0001', 'irtt01')}.", "a": ' applicRefId="app-pre-m01"' + ch("modify")},
               {"t": f"Open the two latches (4). Refer to {iref('fig-0002', 'irtt01')}.", "a": ' applicRefId="app-post-m01"' + ch("add"), "id": "stp-0007"}]
              if two else [f"Remove the four screws (2) and the four washers (3). Refer to {iref('fig-0001', 'irtt01')}."])
    tool = ('<supportEquipDescr id="seq-0001"' + (' applicRefId="app-pre-m01"' + ch("modify") if two else "") + "><name>Screwdriver, cross-head, size 2</name><identNumber><manufacturerCode>0DEMO</manufacturerCode><partAndSerialNumber><partNumber>ARF-GSE-02</partNumber></partAndSerialNumber></identNumber><reqQuantity>1</reqQuantity></supportEquipDescr>")
    body = steps([
        {"t": "Open the access panel.", "pre": ""},
        "Disconnect the connector (11) from the fan assembly (1).",
        "Hold the fan assembly (1).",
    ] + fixing + [
        "Remove the fan assembly (1) from the frame.",
        "Put the fan assembly on a clean bench surface.",
    ])
    content = f"""<content>
{APPLIC_M01 if two else ""}
<procedure>
<preliminaryRqmts>
<reqCondGroup><reqCondDm><reqCond>Stop the rig and disconnect the bench power supply.</reqCond>{dmref(OPER)}</reqCondDm></reqCondGroup>
<reqSupportEquips><supportEquipDescrGroup>{tool}</supportEquipDescrGroup></reqSupportEquips>
<reqSupplies><noSupplies/></reqSupplies>
<reqSpares><noSpares/></reqSpares>
<reqSafety><safetyRqmts>{WARN_POWER}</safetyRqmts></reqSafety>
</preliminaryRqmts>
<mainProcedure>
{figs}
{body}
</mainProcedure>
<closeRqmts><reqCondGroup><noConds/></reqCondGroup></closeRqmts>
</procedure>
</content>"""
    icns = [ICN["fan-screws"], ICN["fan-latches"]] if two else [ICN["fan-screws"]]
    if two:
        return dmodule(REMOVE, "002", content, date=D2, icns=icns, changed=True,
                       rfu="EC-ARF-01: Modification M01. The step to release the fan assembly now depends on the modification status.")
    return dmodule(REMOVE, "001", content, icns=icns)


def install(issue):
    two = issue == "002"
    figs = (figure("fig-0001", "Fan assembly - removal and installation (before Modification M01)", ICN["fan-screws"], attrs=f' applicRefId="app-pre-m01"{ch("modify")}')
            + figure("fig-0002", "Fan assembly - removal and installation (after Modification M01)", ICN["fan-latches"], attrs=f' applicRefId="app-post-m01"{ch("add")}')
            if two else figure("fig-0001", "Fan assembly - removal and installation", ICN["fan-screws"]))
    pre = ' applicRefId="app-pre-m01"' + ch("modify") if two else ""
    fixing = [
        {"t": f"Install the four washers (3) and the four screws (2). Refer to {iref('fig-0001', 'irtt01')}.", "a": pre},
        {"t": "Torque the four screws (2) to 2.5 N.m.", "a": pre},
    ]
    if two:
        fixing += [
            {"t": f"Close the two latches (4). Refer to {iref('fig-0002', 'irtt01')}.", "a": ' applicRefId="app-post-m01"' + ch("add"), "id": "stp-0007"},
            {"t": "Make sure that each latch is locked.", "a": ' applicRefId="app-post-m01"' + ch("add"), "id": "stp-0008",
             "pre": "<note><notePara>A locked latch is flat against the bracket.</notePara></note>"},
        ]
    mark = ' applicRefId="app-pre-m01"' + ch("modify") if two else ""
    tools = ('<supportEquipDescr id="seq-0001"' + mark + "><name>Screwdriver, cross-head, size 2</name><identNumber><manufacturerCode>0DEMO</manufacturerCode><partAndSerialNumber><partNumber>ARF-GSE-02</partNumber></partAndSerialNumber></identNumber><reqQuantity>1</reqQuantity></supportEquipDescr>"
             + '<supportEquipDescr id="seq-0002"' + mark + "><name>Torque screwdriver, 1 N.m to 5 N.m</name><identNumber><manufacturerCode>0DEMO</manufacturerCode><partAndSerialNumber><partNumber>ARF-GSE-03</partNumber></partAndSerialNumber></identNumber><reqQuantity>1</reqQuantity></supportEquipDescr>")
    body = steps([
        "Put the fan assembly (1) in its position on the frame.",
    ] + fixing + [
        "Connect the connector (11) to the fan assembly (1).",
        "Close the access panel.",
        f"Do a function test of the fan assembly. Refer to {dmref(TEST, title=TITLES['340'])}.",
    ])
    content = f"""<content>
{APPLIC_M01 if two else ""}
<procedure>
<preliminaryRqmts>
<reqCondGroup><reqCondDm><reqCond>The fan assembly is removed.</reqCond>{dmref(REMOVE)}</reqCondDm></reqCondGroup>
<reqSupportEquips><supportEquipDescrGroup>{tools}</supportEquipDescrGroup></reqSupportEquips>
<reqSupplies><noSupplies/></reqSupplies>
<reqSpares><noSpares/></reqSpares>
<reqSafety><safetyRqmts>{WARN_POWER}</safetyRqmts></reqSafety>
</preliminaryRqmts>
<mainProcedure>
{figs}
{body}
</mainProcedure>
<closeRqmts><reqCondGroup><reqCondNoRef><reqCond>The fan assembly is installed and the function test is satisfactory.</reqCond></reqCondNoRef></reqCondGroup></closeRqmts>
</procedure>
</content>"""
    icns = [ICN["fan-screws"], ICN["fan-latches"]] if two else [ICN["fan-screws"]]
    if two:
        return dmodule(INSTALL, "002", content, date=D2, icns=icns, changed=True,
                       rfu="EC-ARF-01: Modification M01. Steps to close and lock the latches are added. The torque step applies before Modification M01 only.")
    return dmodule(INSTALL, "001", content, icns=icns)

# ---------------------------------------------------------------- Examination, adjustment, test


def filter_exam():
    table = """<table id="tab-0001"><title>Filter element - results of the examination</title>
<tgroup cols="2"><colspec colname="col1"/><colspec colname="col2"/>
<thead><row><entry><para>Condition of the filter element</para></entry><entry><para>Action</para></entry></row></thead>
<tbody>
<row><entry><para>Clean. No damage.</para></entry><entry><para>Install the filter element again.</para></entry></row>
<row><entry><para>Dust on the upstream surface only</para></entry><entry><para>Install the filter element again. Record the condition.</para></entry></row>
<row><entry><para>Torn, wet or with dust on the downstream surface</para></entry><entry><para>Install a new filter element (7).</para></entry></row>
</tbody></tgroup></table>"""
    body = steps([
        f"Look at the differential pressure indicator (9). Refer to {iref('fig-0001', 'irtt01')}.",
        {"t": "If the indicator shows a red band, record the result.", "pre": "<note><notePara>The red band shows that the filter element is blocked.</notePara></note>"},
        "Release the clamp (8).",
        "Remove the cover of the filter housing (6).",
        "Remove the filter element (7).",
        {"t": f"Examine the filter element (7) for damage and contamination. Refer to {iref('tab-0001', 'irtt02')}.", "post": table},
        "Install the filter element (7) in the filter housing (6).",
        "Install the cover of the filter housing (6).",
        "Engage the clamp (8).",
        "Push the reset button of the differential pressure indicator (9).",
        "Make sure that the indicator shows a green band.",
    ])
    content = f"""<content>
<procedure>
<preliminaryRqmts>
<reqCondGroup><reqCondDm><reqCond>Stop the rig and disconnect the bench power supply.</reqCond>{dmref(OPER)}</reqCondDm></reqCondGroup>
<reqSupportEquips><noSupportEquips/></reqSupportEquips>
<reqSupplies><noSupplies/></reqSupplies>
<reqSpares><spareDescrGroup><spareDescr id="spa-0001"><name>Filter element</name><identNumber><manufacturerCode>0DEMO</manufacturerCode><partAndSerialNumber><partNumber>ARF-3100</partNumber></partAndSerialNumber></identNumber><reqQuantity>1</reqQuantity></spareDescr></spareDescrGroup></reqSpares>
<reqSafety><noSafety/></reqSafety>
</preliminaryRqmts>
<mainProcedure>
{figure("fig-0001", "Air filter - examination", ICN["filter"])}
{body}
</mainProcedure>
<closeRqmts><reqCondGroup><noConds/></reqCondGroup></closeRqmts>
</procedure>
</content>"""
    return dmodule(FILTER, "001", content, icns=[ICN["filter"]])


CAUTION_ESD = ("<caution><warningAndCautionPara>Do not touch the components on the circuit board. "
               "Electrostatic discharge can cause damage to the components.</warningAndCautionPara></caution>")


def adjust():
    body = steps([
        "Remove the four screws of the control box cover.",
        "Remove the control box cover.",
        f"Connect the multimeter {iref('seq-0001', 'irtt05')} to the test points TP1 (+) and TP2 (-). Refer to {iref('fig-0001', 'irtt01')}.",
        f"Start the rig. Refer to {dmref(OPER, title=TITLES['131'])}.",
        "Set the speed control R1 to MAX.",
        {"t": "Turn the adjustment potentiometer R2 until the multimeter shows 10.0 V DC, tolerance 0.2 V.", "pre": CAUTION_ESD},
        "Make sure that the pointer of the airflow indicator is in the green band.",
        "Stop the rig.",
        "Disconnect the multimeter.",
        "Install the control box cover with the four screws.",
    ])
    content = f"""<content>
<procedure>
<preliminaryRqmts>
<reqCondGroup><reqCondNoRef><reqCond>The fan assembly is installed.</reqCond></reqCondNoRef></reqCondGroup>
<reqSupportEquips><supportEquipDescrGroup>
<supportEquipDescr id="seq-0001"><name>Multimeter, DC voltage</name><identNumber><manufacturerCode>0DEMO</manufacturerCode><partAndSerialNumber><partNumber>ARF-GSE-04</partNumber></partAndSerialNumber></identNumber><reqQuantity>1</reqQuantity></supportEquipDescr>
<supportEquipDescr id="seq-0002"><name>Screwdriver, flat, 2 mm</name><identNumber><manufacturerCode>0DEMO</manufacturerCode><partAndSerialNumber><partNumber>ARF-GSE-05</partNumber></partAndSerialNumber></identNumber><reqQuantity>1</reqQuantity></supportEquipDescr>
</supportEquipDescrGroup></reqSupportEquips>
<reqSupplies><noSupplies/></reqSupplies>
<reqSpares><noSpares/></reqSpares>
<reqSafety><safetyRqmts>{CAUTION_ESD}</safetyRqmts></reqSafety>
</preliminaryRqmts>
<mainProcedure>
{figure("fig-0001", "Control box - test points and adjustment potentiometer", ICN["control"])}
{body}
</mainProcedure>
<closeRqmts><reqCondGroup><noConds/></reqCondGroup></closeRqmts>
</procedure>
</content>"""
    return dmodule(ADJUST, "001", content, icns=[ICN["control"]])


def function_test():
    table = """<table id="tab-0001"><title>Fan assembly - function test results</title>
<tgroup cols="3"><colspec colname="col1"/><colspec colname="col2"/><colspec colname="col3"/>
<thead><row><entry><para>Speed control R1</para></entry><entry><para>Airflow indicator</para></entry><entry><para>FAN FAULT lamp DS2</para></entry></row></thead>
<tbody>
<row><entry><para>MIN</para></entry><entry><para>Pointer in the white band</para></entry><entry><para>Off</para></entry></row>
<row><entry><para>MAX</para></entry><entry><para>Pointer in the green band</para></entry><entry><para>Off</para></entry></row>
</tbody></tgroup></table>"""
    body = steps([
        f"Start the rig. Refer to {dmref(OPER, title=TITLES['131'])}.",
        f"If the fan does not run, do the fault isolation procedure. Refer to {dmref(FAULT, title=TITLES['421'])}.",
        {"t": f"Set the speed control R1 to MIN. Make sure that the results agree with {iref('tab-0001', 'irtt02')}.", "post": table},
        "Set the speed control R1 to MAX.",
        "Make sure that the pointer of the airflow indicator is in the green band.",
        "Listen to the fan assembly for 30 seconds.",
        {"t": f"If you hear a noise from the fan bearing, replace the fan assembly. Refer to {dmref(REMOVE, title=TITLES['520'])} and {dmref(INSTALL, title=TITLES['720'])}.",
         "pre": "<note><notePara>A smooth, even sound is normal.</notePara></note>"},
        {"t": f"If the pointer is not in the green band, adjust the fan speed. Refer to {dmref(ADJUST, title=TITLES['271'])}."},
        "Stop the rig.",
    ])
    content = f"""<content>
<procedure>
<preliminaryRqmts>
<reqCondGroup><reqCondNoRef><reqCond>The fan assembly is installed and the access panel is closed.</reqCond></reqCondNoRef></reqCondGroup>
<reqSupportEquips><supportEquipDescrGroup><supportEquipDescr id="seq-0001"><name>Bench power supply, 24 V DC</name><identNumber><manufacturerCode>0DEMO</manufacturerCode><partAndSerialNumber><partNumber>ARF-GSE-01</partNumber></partAndSerialNumber></identNumber><reqQuantity>1</reqQuantity></supportEquipDescr></supportEquipDescrGroup></reqSupportEquips>
<reqSupplies><noSupplies/></reqSupplies>
<reqSpares><noSpares/></reqSpares>
<reqSafety><safetyRqmts>{WARN_POWER.replace("Disconnect the bench power supply before you touch the fan assembly.", "Keep the access panel closed when the fan operates.")}</safetyRqmts></reqSafety>
</preliminaryRqmts>
<mainProcedure>
{body}
</mainProcedure>
<closeRqmts><reqCondGroup><noConds/></reqCondGroup></closeRqmts>
</procedure>
</content>"""
    return dmodule(TEST, "001", content)

# ---------------------------------------------------------------- Fault isolation


def fault():
    def step(i, action, question, yes, no):
        return (f'<isolationStep id="{i}"><action>{action}</action><isolationStepQuestion>{question}</isolationStepQuestion>'
                f'<isolationStepAnswer><yesNoAnswer><yesAnswer nextActionRefId="{yes}"/><noAnswer nextActionRefId="{no}"/></yesNoAnswer></isolationStepAnswer></isolationStep>')

    def end(i, action):
        return f'<isolationProcedureEnd id="{i}"><action>{action}</action></isolationProcedureEnd>'
    body = "\n".join([
        step("stp-0001", f"Connect the bench power supply. Set the power switch S1 to ON. Refer to {iref('fig-0001', 'irtt01')}.", "Does the POWER lamp DS1 come on?", "stp-0003", "stp-0002"),
        step("stp-0002", "Look at the circuit breaker CB1.", "Is the button of CB1 out?", "end-0001", "end-0002"),
        step("stp-0003", "Turn the speed control R1 to MAX.", "Does the fan run?", "end-0003", "stp-0004"),
        step("stp-0004", "Look at the FAN FAULT lamp DS2.", "Does DS2 come on?", "stp-0005", "end-0004"),
        step("stp-0005", "Set the power switch S1 to OFF. Disconnect the bench power supply. Disconnect the fan harness connector from the fan assembly. Examine the pins of the connector.",
             "Are all pins straight and clean?", "end-0005", "end-0006"),
        end("end-0001", "Push the button of CB1 to reset it. If CB1 opens again, replace the control box. Then do this procedure again."),
        end("end-0002", "Make sure that the bench power supply is set to 24 V DC and is on. If it is, replace the control box."),
        end("end-0003", f"The fan runs at MAX. Do the function test of the fan assembly. Refer to {dmref(TEST, title=TITLES['340'])}."),
        end("end-0004", "Replace the control box. Then do the function test of the fan assembly."),
        end("end-0005", f"Replace the fan assembly. Refer to {dmref(REMOVE, title=TITLES['520'])} and {dmref(INSTALL, title=TITLES['720'])}."),
        end("end-0006", "Clean or straighten the pins. If a pin is broken, replace the connector. Then do this procedure again."),
    ])
    content = f"""<content>
<faultIsolation>
<faultIsolationProcedure>
<isolationProcedure>
<preliminaryRqmts>
<reqCondGroup><reqCondNoRef><reqCond>The fan does not run when the power switch S1 is ON.</reqCond></reqCondNoRef></reqCondGroup>
<reqSupportEquips><supportEquipDescrGroup><supportEquipDescr id="seq-0001"><name>Bench power supply, 24 V DC</name><identNumber><manufacturerCode>0DEMO</manufacturerCode><partAndSerialNumber><partNumber>ARF-GSE-01</partNumber></partAndSerialNumber></identNumber><reqQuantity>1</reqQuantity></supportEquipDescr></supportEquipDescrGroup></reqSupportEquips>
<reqSupplies><noSupplies/></reqSupplies>
<reqSpares><noSpares/></reqSpares>
<reqSafety><safetyRqmts>{WARN_POWER}</safetyRqmts></reqSafety>
</preliminaryRqmts>
<isolationMainProcedure>
{figure("fig-0001", "Control box - controls and indicators", ICN["control"])}
{body}
</isolationMainProcedure>
<closeRqmts><reqCondGroup><noConds/></reqCondGroup></closeRqmts>
</isolationProcedure>
</faultIsolationProcedure>
</faultIsolation>
</content>"""
    return dmodule(FAULT, "001", content, icns=[ICN["control"]])

# ---------------------------------------------------------------- Illustrated parts data

# (item, isn, indenture, qty, part number, description, applicRef, added in issue 002)
PARTS = [
    ("001", "00A", "1", "1", "ARF-2000", "Fan assembly", None, False),
    ("002", "00A", "1", "4", "ARF-9101", "Screw, fan mounting", "app-pre-m01", False),
    ("003", "00A", "1", "4", "ARF-9102", "Washer, flat", "app-pre-m01", False),
    ("004", "00A", "1", "2", "ARF-9201", "Latch, quick-release", "app-post-m01", True),
    ("005", "00A", "1", "2", "ARF-9202", "Bracket, latch", "app-post-m01", True),
    ("006", "00A", "1", "1", "ARF-3000", "Filter housing", None, False),
    ("007", "00A", "2", "1", "ARF-3100", "Filter element", None, False),
    ("008", "00A", "2", "1", "ARF-3200", "Clamp, filter housing cover", None, False),
    ("009", "00A", "2", "1", "ARF-3300", "Indicator, differential pressure", None, False),
    ("010", "00A", "1", "1", "ARF-4000", "Control box", None, False),
    ("011", "00A", "1", "1", "ARF-4100", "Connector, fan harness", None, False),
    ("012", "00A", "1", "1", "ARF-1100", "Access panel, transparent", "app-classroom", False),
    ("012", "00B", "1", "1", "ARF-1101", "Access panel, metal", "app-workshop", False),
]


def ipd(issue):
    two = issue == "002"
    icn = ICN["ipd-2"] if two else ICN["ipd-1"]
    items = sorted({p[0] for p in PARTS if two or not p[7]})
    names = {p[0]: p[5] for p in PARTS}
    hot = "".join(f'<hotspot id="hot-{it}" hotspotType="callout" applicationStructureIdent="item-{it}" applicationStructureName="{esc(names[it])}"/>' for it in items)
    csn, by_item = [], {}
    for p in PARTS:
        if p[7] and not two:
            continue
        by_item.setdefault(p[0], []).append(p)
    for it, group in by_item.items():
        for k, (_, isn, ind, qty, pn, descr, app, _a) in enumerate(group):
            # Alternative parts of one item (the two access panels) are item variants A and B, each with its applicability.
            variant = f' itemVariant="{chr(65 + k)}"' if len(group) > 1 else ""
            m01 = app and "m01" in app
            if m01 and not two:
                app = None  # issue 001 came before Modification M01: the screws and washers simply apply
            a = f' applicRefId="{app}"' if app else ""
            added = ch("add") if (group[0][7] and two) else ch("modify") if (m01 and two) else ""
            csn.append(f'<catalogSeqNumber figureNumber="01" item="{it}"{variant} indenture="{ind}"{a}{added}>'
                       f'<itemSeqNumber itemSeqNumberValue="00A">'
                       f"<quantityPerNextHigherAssy>{qty}</quantityPerNextHigherAssy>"
                       f'<partRef manufacturerCodeValue="{ISSUER}" partNumberValue="{pn}"/>'
                       f"<partSegment><itemIdentData><descrForPart>{esc(descr)}</descrForPart></itemIdentData></partSegment>"
                       "</itemSeqNumber></catalogSeqNumber>")
    applic = (APPLIC_M01.replace("</referencedApplicGroup>", APPLIC_VARIANT + "\n</referencedApplicGroup>") if two
              else "<referencedApplicGroup>\n" + APPLIC_VARIANT + "\n</referencedApplicGroup>")
    content = f"""<content>
{applic}
<illustratedPartsCatalog>
<figure id="fig-0001"><title>Training rig</title><graphic infoEntityIdent="{icn}">{hot}</graphic></figure>
{chr(10).join(csn)}
</illustratedPartsCatalog>
</content>"""
    if two:
        return dmodule(IPD, "002", content, date=D2, icns=[icn], changed=True,
                       rfu="EC-ARF-01: Modification M01. Items 004 and 005 are added. Items 002 and 003 apply before Modification M01 only.")
    return dmodule(IPD, "001", content, icns=[icn])

# ---------------------------------------------------------------- Publication modules


def pm(number, issue, title, entries, date):
    two = issue == "002"
    groups = []
    for head, refs in entries:
        groups.append(f"<pmEntry><pmEntryTitle>{esc(head)}</pmEntryTitle>" + "".join(dmref(c, issue=i, title=TITLES[c["ic"]]) for c, i in refs) + "</pmEntry>")
    rfu = (f'<reasonForUpdate id="{RFU}" updateHighlight="1" updateReasonType="urt02"><simplePara>EC-ARF-01: the publication now contains the issues of the data modules changed by Modification M01.</simplePara></reasonForUpdate>' if two else "")
    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE pm>
<pm {NS} xsi:noNamespaceSchemaLocation="{SCHEMA}pm.xsd">
<identAndStatusSection>
<pmAddress>
<pmIdent>
<pmCode modelIdentCode="{MIC}" pmIssuer="{ISSUER}" pmNumber="{number}" pmVolume="00"/>
<language languageIsoCode="en" countryIsoCode="US"/>
<issueInfo issueNumber="{issue}" inWork="00"/>
</pmIdent>
<pmAddressItems>
<issueDate year="{date[0]}" month="{date[1]}" day="{date[2]}"/>
<pmTitle>{esc(title)}</pmTitle>
</pmAddressItems>
</pmAddress>
<pmStatus issueType="{"changed" if two else "new"}">
<security securityClassification="01"/>
{RESTRICT}
<responsiblePartnerCompany><enterpriseName>{TEAM}</enterpriseName></responsiblePartnerCompany>
<applicCrossRefTableRef>{dmref(ACT)}</applicCrossRefTableRef>
<applic><displayText><simplePara>ARF-1 training rig, serial numbers 001 to 003</simplePara></displayText></applic>
<brexDmRef>{dmref(BREX)}</brexDmRef>
<qualityAssurance><unverified/></qualityAssurance>
{rfu}
</pmStatus>
</identAndStatusSection>
<content>
{chr(10).join(groups)}
</content>
</pm>
"""
    name = f"PMC-{MIC}-{ISSUER}-{number}-00_{issue}-00_EN-US.XML"
    return name, "\n".join(line for line in xml.split("\n") if line.strip() != "")


def maintenance_pm(issue):
    i = "002" if issue == "002" else "001"
    return pm("00001", issue, "ARF-1 training rig - Maintenance publication", [
        ("Description", [(DESCR, i)]),
        ("Fan assembly", [(REMOVE, i), (INSTALL, i), (ADJUST, "001"), (TEST, "001")]),
        ("Air filter", [(FILTER, "001")]),
        ("Fault isolation", [(FAULT, "001")]),
        ("Illustrated parts data", [(IPD, i)]),
    ], D2 if issue == "002" else D1)


def operator_pm(issue):
    i = "002" if issue == "002" else "001"
    return pm("00002", issue, "ARF-1 training rig - Operator publication", [
        ("Description", [(DESCR, i)]),
        ("Operation", [(OPER, "001")]),
    ], D2 if issue == "002" else D1)


def main():
    os.makedirs(OUT, exist_ok=True)
    made = [brex(), act("001"), act("002"), cct(), pct("001"), pct("002"), description("001"), description("002"), operation(), remove("001"), remove("002"),
            install("001"), install("002"), filter_exam(), adjust(), function_test(), fault(), ipd("001"), ipd("002"),
            maintenance_pm("001"), maintenance_pm("002"), operator_pm("001"), operator_pm("002")]
    keep = {name for name, _ in made}
    for f in os.listdir(OUT):
        if f.endswith(".XML") and f not in keep:
            os.remove(os.path.join(OUT, f))
    for name, xml in made:
        with open(os.path.join(OUT, name), "w", encoding="utf-8", newline="\n") as fh:
            fh.write(xml)
    print(f"csdb: {len(made)} modules in {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    sys.exit(main())
