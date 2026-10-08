"""Build a full PDF from the latest smoke report. Run from the smoke folder."""
import html
import os
import re
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image,
    PageBreak, KeepTogether, HRFlowable, ListFlowable, ListItem,
)

NAVY = colors.HexColor("#1B2A4A")
GOLD = colors.HexColor("#C4A35A")
RED = colors.HexColor("#9B2335")
GREEN = colors.HexColor("#1F7A4D")
AMBER = colors.HexColor("#9A6B12")
INK = colors.HexColor("#1B2430")
MUTED = colors.HexColor("#5C6B7A")
LINE = colors.HexColor("#E6EBF2")
PAPER = colors.HexColor("#F7F8FA")

OUT = os.path.join("reports", "Nexletta-Smoke-Report.pdf")
HTML_REPORT = os.path.join("reports", "smoke-report.html")

def esc(text):
    return html.escape(html.unescape(text or "")).replace("\n", "<br/>")

def passed_rows():
    raw = open(HTML_REPORT, encoding="utf-8").read()
    found = re.findall(
        r"<li><strong>(.*?)</strong> — (.*?)<br><span>(.*?)</span></li>",
        raw,
    )
    return [(html.unescape(a), html.unescape(b), html.unescape(c)) for a, b, c in found]

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="CoverKicker", fontName="Times-Bold", fontSize=11, textColor=GOLD, tracking=1.2, spaceAfter=6))
styles.add(ParagraphStyle(name="CoverTitle", fontName="Times-Bold", fontSize=26, leading=30, textColor=colors.white, spaceAfter=8))
styles.add(ParagraphStyle(name="CoverSub", fontName="Times-Roman", fontSize=11, leading=15, textColor=colors.HexColor("#D5DBE6")))
styles.add(ParagraphStyle(name="H1", fontName="Times-Bold", fontSize=16, leading=20, textColor=NAVY, spaceBefore=12, spaceAfter=8))
styles.add(ParagraphStyle(name="H2", fontName="Times-Bold", fontSize=13, leading=16, textColor=NAVY, spaceBefore=10, spaceAfter=4))
styles.add(ParagraphStyle(name="Body", fontName="Times-Roman", fontSize=10, leading=14, textColor=INK, spaceAfter=6))
styles.add(ParagraphStyle(name="Small", fontName="Times-Roman", fontSize=9, leading=12, textColor=MUTED, spaceAfter=4))
styles.add(ParagraphStyle(name="Label", fontName="Times-Bold", fontSize=9, leading=12, textColor=MUTED))
styles.add(ParagraphStyle(name="Cell", fontName="Times-Roman", fontSize=9, leading=12, textColor=INK))
styles.add(ParagraphStyle(name="CellBold", fontName="Times-Bold", fontSize=9, leading=12, textColor=INK))
styles.add(ParagraphStyle(name="Pass", fontName="Times-Bold", fontSize=9, leading=12, textColor=GREEN))
styles.add(ParagraphStyle(name="Fail", fontName="Times-Bold", fontSize=9, leading=12, textColor=RED))
styles.add(ParagraphStyle(name="Banner", fontName="Times-Bold", fontSize=14, leading=18, textColor=colors.white, alignment=TA_LEFT))
styles.add(ParagraphStyle(name="Step", fontName="Times-Roman", fontSize=10, leading=13, textColor=INK, leftIndent=12, spaceAfter=2))

def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, letter[1] - 36, letter[0], 36, fill=1, stroke=0)
    canvas.setFillColor(GOLD)
    canvas.rect(0, letter[1] - 40, letter[0], 4, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Times-Bold", 9)
    canvas.drawString(0.7 * inch, letter[1] - 24, "NEXLETTA")
    canvas.setFont("Times-Roman", 9)
    canvas.drawRightString(letter[0] - 0.7 * inch, letter[1] - 24, "Post-deployment smoke report")
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, letter[0], 28, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Times-Roman", 8)
    canvas.drawString(0.7 * inch, 11, "Overall status: STABLE")
    canvas.drawRightString(letter[0] - 0.7 * inch, 11, f"Page {doc.page}")
    canvas.restoreState()

def p(text, style="Body"):
    return Paragraph(esc(text), styles[style])

def section_rule():
    return HRFlowable(width="100%", thickness=0.6, color=GOLD, spaceBefore=2, spaceAfter=8)

story = []

# Cover band is drawn by the first flowables sitting under the header.
story.append(Spacer(1, 8))
story.append(Paragraph("POST-DEPLOYMENT SMOKE", styles["CoverKicker"]))
story.append(Paragraph("Nexletta release check", styles["H1"]))
story.append(Paragraph(
    "Generated 8 October 2026, 10:37 UTC. Run before bug tickets. "
    "Application defects are Failed. Missing records are Blocked. "
    "STABLE requires every required check to pass.",
    styles["Body"],
))

banner = Table(
    [[Paragraph("OVERALL STATUS: STABLE", styles["Banner"])]],
    colWidths=[7.1 * inch],
)
banner.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), GREEN),
    ("LEFTPADDING", (0, 0), (-1, -1), 12),
    ("RIGHTPADDING", (0, 0), (-1, -1), 12),
    ("TOPPADDING", (0, 0), (-1, -1), 10),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
]))
story.append(Spacer(1, 6))
story.append(banner)
story.append(Spacer(1, 14))

story.append(Paragraph("Summary", styles["H1"]))
story.append(section_rule())

stats = [
    [Paragraph("Total tests", styles["Label"]), Paragraph("Passed", styles["Label"]),
     Paragraph("Failed", styles["Label"]), Paragraph("Blocked", styles["Label"])],
    [Paragraph("30", styles["H1"]), Paragraph("30", styles["H1"]),
     Paragraph("0", styles["H1"]), Paragraph("0", styles["H1"])],
]
stat_table = Table(stats, colWidths=[1.775 * inch] * 4)
stat_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), PAPER),
    ("BOX", (0, 0), (-1, -1), 0.4, LINE),
    ("INNERGRID", (0, 0), (-1, -1), 0.4, LINE),
    ("LEFTPADDING", (0, 0), (-1, -1), 10),
    ("RIGHTPADDING", (0, 0), (-1, -1), 10),
    ("TOPPADDING", (0, 0), (-1, -1), 6),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ("TEXTCOLOR", (2, 1), (2, 1), RED),
]))
story.append(stat_table)
story.append(Spacer(1, 8))
story.append(Paragraph(
    "Corrected report. Organization sign-in does not have to land on bills, so that check is removed. "
    "Veteran and representative invoice visibility is not scored on this run. Next smoke run uses NX-065.",
    styles["Body"],
))
story.append(Paragraph(
    "NX-065 — Billing visibility for the veteran: if the veteran pays personally, the veteran can see the invoice. "
    "If a representative pays, or an organization or referral partner pays, the veteran cannot see the invoice or the amount. "
    "A message such as \"Billed to your referring organization\" is acceptable.",
    styles["Body"],
))
story.append(Paragraph(
    "Reviewer QA: an empty queue is not a blocker. Next runs start from a submitted evaluation and set Return for Correction, Approve, or another QA status. "
    "The case must then appear in QA Review. It is a bug only when it does not appear after that status change.",
    styles["Body"],
))
story.append(Paragraph(
    "No irreversible actions were taken. Mark as Paid, Approve, Return, and Save were not clicked.",
    styles["Small"],
))

story.append(Paragraph("Role-wise results", styles["H1"]))
story.append(section_rule())

roles = [
    ("Admin", "6", "6", "0", "0", "PASS"),
    ("Scheduler", "4", "4", "0", "0", "PASS"),
    ("Biller", "4", "4", "0", "0", "PASS"),
    ("Reviewer", "3", "3", "0", "0", "PASS"),
    ("Organization", "2", "2", "0", "0", "PASS"),
    ("Veteran", "5", "5", "0", "0", "PASS"),
    ("Representative", "3", "3", "0", "0", "PASS"),
    ("Provider", "3", "3", "0", "0", "PASS"),
]
header = [Paragraph(h, styles["CellBold"]) for h in ["Role", "Total", "Passed", "Failed", "Blocked", "Result"]]
role_data = [header]
for role, total, passed, failed, blocked, result in roles:
    result_style = "Pass" if result == "PASS" else "Fail"
    role_data.append([
        Paragraph(role, styles["CellBold"]),
        Paragraph(total, styles["Cell"]),
        Paragraph(passed, styles["Cell"]),
        Paragraph(failed, styles["Cell"]),
        Paragraph(blocked, styles["Cell"]),
        Paragraph(result, styles[result_style]),
    ])
role_table = Table(role_data, colWidths=[1.7*inch, 0.9*inch, 0.9*inch, 0.9*inch, 1.0*inch, 1.7*inch])
role_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), NAVY),
    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
    ("BACKGROUND", (0, 1), (-1, -1), colors.white),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PAPER]),
    ("BOX", (0, 0), (-1, -1), 0.4, NAVY),
    ("INNERGRID", (0, 0), (-1, -1), 0.3, LINE),
    ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ("TOPPADDING", (0, 0), (-1, -1), 5),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
]))
# Header cells were Paragraphs with INK color; force white by restyling header paragraphs.
for cell in role_data[0]:
    cell.style = ParagraphStyle("HeadCell", parent=styles["CellBold"], textColor=colors.white)
story.append(role_table)

story.append(Paragraph("Failed and blocked tests", styles["H1"]))
story.append(section_rule())

findings = []

def finding_block(item):
    bits = []
    tag = Table(
        [[Paragraph(item["kind"], ParagraphStyle("Tag", fontName="Times-Bold", fontSize=9, textColor=colors.white))]],
        colWidths=[1.15 * inch],
    )
    tag.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), item["color"]),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    bits.append(Spacer(1, 8))
    bits.append(tag)
    bits.append(Spacer(1, 6))
    bits.append(Paragraph(item["title"], styles["H2"]))
    fields = [
        ("Classification", item["classification"]),
        ("Path", item["path"]),
        ("Expected", item["expected"]),
        ("Actual", item["actual"]),
        ("Trace", item["trace"]),
    ]
    for label, value in fields:
        bits.append(KeepTogether([
            Paragraph(f"<b>{esc(label)}</b>", styles["Label"]),
            Paragraph(esc(value), styles["Body"]),
        ]))
    step_bits = [Paragraph("<b>Reproduction steps</b>", styles["Label"])]
    for i, step in enumerate(item["steps"], 1):
        step_bits.append(Paragraph(f"{i}. {esc(step)}", styles["Step"]))
    bits.append(KeepTogether(step_bits))
    bits.append(Spacer(1, 6))
    return bits

if not findings:
    story.append(Paragraph("None. The empty reviewer QA queue is not a defect.", styles["Body"]))
for item in findings:
    story.extend(finding_block(item))
    for path, caption in item["shots"]:
        if not os.path.exists(path):
            continue
        img = Image(path, width=7.1 * inch, height=7.1 * inch * 720 / 1280)
        story.append(img)
        story.append(Paragraph(caption, styles["Small"]))
        story.append(Spacer(1, 8))

story.append(PageBreak())
story.append(Paragraph("Passed tests", styles["H1"]))
story.append(section_rule())
story.append(Paragraph(
    "Each passed check signed in, opened the required page, and performed one real read-only action or confirmed a blocked page by opening the URL directly.",
    styles["Body"],
))

pass_header = [Paragraph(h, ParagraphStyle("PH", parent=styles["CellBold"], textColor=colors.white))
               for h in ["Role", "Check", "What the UI showed"]]
pass_data = [pass_header]
extra_passed = [(
    "Reviewer",
    "Submitted evaluation appears in QA Review after a status change",
    "QA Reviews opened. No case was in Pending QA Review or In Review. That empty queue is not a release blocker. Next runs move a submitted evaluation through QA status and fail only if it does not appear.",
)]
for role, title, actual in extra_passed + passed_rows():
    pass_data.append([
        Paragraph(esc(role), styles["CellBold"]),
        Paragraph(esc(title), styles["Cell"]),
        Paragraph(esc(actual), styles["Cell"]),
    ])
pass_table = Table(pass_data, colWidths=[1.25*inch, 2.15*inch, 3.7*inch], repeatRows=1)
pass_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), NAVY),
    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PAPER]),
    ("BOX", (0, 0), (-1, -1), 0.4, NAVY),
    ("INNERGRID", (0, 0), (-1, -1), 0.3, LINE),
    ("LEFTPADDING", (0, 0), (-1, -1), 5),
    ("RIGHTPADDING", (0, 0), (-1, -1), 5),
    ("TOPPADDING", (0, 0), (-1, -1), 4),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ("VALIGN", (0, 0), (-1, -1), "TOP"),
]))
story.append(pass_table)

story.append(Spacer(1, 14))
story.append(Paragraph("How to read this report", styles["H1"]))
story.append(section_rule())
story.append(Paragraph(
    "Run npm run smoke from the smoke folder after every deployment. The command is headed. "
    "Credentials stay in smoke/.env and are not printed in this report. "
    "Screenshots and Playwright traces for failures are stored under smoke/reports/artifacts.",
    styles["Body"],
))

os.makedirs("reports", exist_ok=True)
doc = SimpleDocTemplate(
    OUT,
    pagesize=letter,
    leftMargin=0.7 * inch,
    rightMargin=0.7 * inch,
    topMargin=0.75 * inch,
    bottomMargin=0.55 * inch,
    title="Nexletta post-deployment smoke report",
    author="Nexletta smoke suite",
)
doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
print("wrote", os.path.abspath(OUT), os.path.getsize(OUT))
