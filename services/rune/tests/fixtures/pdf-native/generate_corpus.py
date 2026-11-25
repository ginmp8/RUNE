#!/usr/bin/env python3
from __future__ import annotations

import json
import struct
import subprocess
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw
from pypdf import PdfReader, PdfWriter
from pypdf.generic import ArrayObject, BooleanObject, DictionaryObject, FloatObject, NameObject, NumberObject, TextStringObject
from reportlab.lib.pagesizes import A4, LETTER, landscape
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

ROOT = Path(__file__).resolve().parent
FIXED_DATE = "D:20260727000000Z"


def canvas_for(path: Path, pagesize=LETTER) -> canvas.Canvas:
    c = canvas.Canvas(str(path), pagesize=pagesize, invariant=1, pageCompression=1)
    c.setAuthor("RUNE native PDF corpus")
    c.setCreator("RUNE corpus generator / ReportLab")
    c.setTitle(path.stem)
    return c


def make_subset_vectors_links() -> None:
    font_path = Path("/usr/share/fonts/fonts-go/Go-Regular.ttf")
    font_name = "RuneGoSubset"
    if font_path.is_file():
        pdfmetrics.registerFont(TTFont(font_name, str(font_path)))
    else:
        font_name = "Helvetica"
    c = canvas_for(ROOT / "reportlab-subset-vectors-links.pdf")
    c.setFont(font_name, 18)
    c.drawString(72, 720, "Selectable subset-font text")
    c.setLineWidth(2)
    c.rect(72, 600, 220, 80, stroke=1, fill=0)
    c.circle(380, 640, 45, stroke=1, fill=0)
    c.setFont(font_name, 11)
    c.drawString(72, 560, "https://example.com/rune")
    c.linkURL("https://example.com/rune", (72, 555, 230, 570), relative=0)
    c.save()


def make_alpha_transparency() -> None:
    image = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.ellipse((8, 8, 120, 120), fill=(255, 0, 0, 120))
    draw.rectangle((40, 20, 110, 105), fill=(0, 80, 255, 120))
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    buffer.seek(0)
    c = canvas_for(ROOT / "reportlab-alpha-transparency.pdf")
    c.setFillAlpha(0.35)
    c.setFillColorRGB(0.1, 0.6, 0.2)
    c.rect(72, 560, 240, 140, fill=1, stroke=0)
    c.setFillAlpha(0.7)
    c.setFillColorRGB(0.2, 0.2, 0.8)
    c.circle(300, 620, 90, fill=1, stroke=0)
    c.setFillAlpha(1)
    c.drawImage(ImageReader(buffer), 360, 540, width=128, height=128, mask="auto")
    c.setFont("Helvetica", 14)
    c.drawString(72, 730, "Transparency and alpha image")
    c.save()


def make_mixed_geometry() -> None:
    c = canvas_for(ROOT / "reportlab-mixed-geometry.pdf", pagesize=A4)
    c.setFont("Helvetica", 14)
    c.drawString(60, A4[1] - 70, "A4 portrait page")
    c.showPage()
    c.setPageSize(landscape(LETTER))
    c.setFont("Helvetica", 14)
    c.drawString(60, landscape(LETTER)[1] - 70, "Letter landscape page")
    c.showPage()
    c.setPageSize((400, 300))
    c.setPageRotation(90)
    c.setFont("Helvetica", 14)
    c.drawString(40, 250, "Custom 400 x 300 point page rotated 90 degrees")
    c.save()


def make_form() -> None:
    c = canvas_for(ROOT / "reportlab-form.pdf")
    c.setFont("Helvetica", 13)
    c.drawString(72, 720, "Interactive form fixture")
    c.acroForm.textfield(name="customer", tooltip="Customer", x=72, y=650, width=220, height=28,
                         borderStyle="inset", forceBorder=True, value="RUNE")
    c.save()


def make_comment() -> None:
    c = canvas_for(ROOT / "reportlab-comment.pdf")
    c.drawString(72, 720, "Comment annotation fixture")
    c.textAnnotation("Flatten or remove this comment", Rect=(72, 650, 100, 680), relative=0)
    c.save()


def copy_with_pypdf(source: Path, destination: Path, mutator) -> None:
    reader = PdfReader(str(source))
    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)
    writer.add_metadata({"/Producer": "pypdf 5.9.0 / RUNE corpus", "/CreationDate": FIXED_DATE, "/ModDate": FIXED_DATE})
    mutator(writer)
    with destination.open("wb") as stream:
        writer.write(stream)


def make_signature() -> None:
    source = ROOT / "reportlab-subset-vectors-links.pdf"
    def mutate(writer: PdfWriter) -> None:
        field = DictionaryObject({
            NameObject("/FT"): NameObject("/Sig"),
            NameObject("/Type"): NameObject("/Annot"),
            NameObject("/Subtype"): NameObject("/Widget"),
            NameObject("/T"): TextStringObject("UnsignedSignature"),
            NameObject("/Rect"): ArrayObject([FloatObject(72), FloatObject(500), FloatObject(240), FloatObject(540)]),
            NameObject("/F"): NumberObject(4),
            NameObject("/P"): writer.pages[0].indirect_reference,
        })
        field_ref = writer._add_object(field)
        writer.pages[0][NameObject("/Annots")] = ArrayObject([field_ref])
        writer._root_object[NameObject("/AcroForm")] = DictionaryObject({
            NameObject("/Fields"): ArrayObject([field_ref]),
            NameObject("/SigFlags"): NumberObject(3)
        })
    copy_with_pypdf(source, ROOT / "pypdf-signature.pdf", mutate)


def make_attachment() -> None:
    source = ROOT / "reportlab-subset-vectors-links.pdf"
    def mutate(writer: PdfWriter) -> None:
        writer.add_attachment("evidence.txt", b"RUNE attachment fixture")
    copy_with_pypdf(source, ROOT / "pypdf-attachment.pdf", mutate)


def make_javascript() -> None:
    source = ROOT / "reportlab-subset-vectors-links.pdf"
    def mutate(writer: PdfWriter) -> None:
        writer.add_js("app.alert('RUNE fixture');")
    copy_with_pypdf(source, ROOT / "pypdf-javascript.pdf", mutate)


def make_type3() -> None:
    # A minimal one-page PDF with a Type 3 font glyph drawn as a vector rectangle.
    objects: list[bytes] = []
    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objects.append(b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    objects.append(b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 400 300] /Resources << /Font << /F1 4 0 R >> >> /Contents 7 0 R >>")
    objects.append(b"<< /Type /Font /Subtype /Type3 /Name /F1 /FontBBox [0 0 600 700] /FontMatrix [0.001 0 0 0.001 0 0] /CharProcs << /A 5 0 R >> /Encoding << /Type /Encoding /Differences [65 /A] >> /FirstChar 65 /LastChar 65 /Widths [600] >>")
    glyph = b"0 0 600 700 re 0.2 0.5 0.9 rg f"
    objects.append(b"<< /Length %d >>\nstream\n" % len(glyph) + glyph + b"\nendstream")
    objects.append(b"<< /Producer (RUNE manual Type3 producer) /CreationDate (D:20260727000000Z) >>")
    content = b"BT /F1 72 Tf 72 170 Td (AAAA) Tj ET"
    objects.append(b"<< /Length %d >>\nstream\n" % len(content) + content + b"\nendstream")
    write_classic_pdf(ROOT / "rune-type3-font.pdf", objects, root_object=1, info_object=6)


def write_classic_pdf(path: Path, objects: list[bytes], root_object: int, info_object: int | None = None) -> None:
    data = bytearray(b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]
    for index, body in enumerate(objects, 1):
        offsets.append(len(data))
        data.extend(f"{index} 0 obj\n".encode())
        data.extend(body)
        data.extend(b"\nendobj\n")
    xref = len(data)
    data.extend(f"xref\n0 {len(objects)+1}\n".encode())
    data.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        data.extend(f"{offset:010d} 00000 n \n".encode())
    trailer = f"trailer\n<< /Size {len(objects)+1} /Root {root_object} 0 R"
    if info_object is not None:
        trailer += f" /Info {info_object} 0 R"
    trailer += f" >>\nstartxref\n{xref}\n%%EOF\n"
    data.extend(trailer.encode())
    path.write_bytes(data)


def make_object_stream() -> None:
    # Objects 2, 3, and 4 are stored inside /ObjStm 6. Streams remain direct as required by PDF 1.5.
    embedded = [
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    offsets = []
    body = bytearray()
    for item in embedded:
        offsets.append(len(body))
        body.extend(item + b" ")
    header = " ".join(f"{number} {offset}" for number, offset in zip((2,3,4), offsets)).encode() + b" "
    objstm_data = header + body
    content = b"BT /F1 18 Tf 72 720 Td (Object stream fixture) Tj ET"
    data = bytearray(b"%PDF-1.5\n%\xe2\xe3\xcf\xd3\n")
    direct_offsets = {}
    def direct(number: int, payload: bytes) -> None:
        direct_offsets[number] = len(data)
        data.extend(f"{number} 0 obj\n".encode() + payload + b"\nendobj\n")
    direct(1, b"<< /Type /Catalog /Pages 2 0 R >>")
    direct(5, b"<< /Length %d >>\nstream\n" % len(content) + content + b"\nendstream")
    direct(6, b"<< /Type /ObjStm /N 3 /First %d /Length %d >>\nstream\n" % (len(header), len(objstm_data)) + objstm_data + b"\nendstream")
    xref_offset = len(data)
    # Build xref stream object 7. W=[1,4,2].
    entries = []
    entries.append((0,0,65535))
    entries.append((1,direct_offsets[1],0))
    entries.append((2,6,0))
    entries.append((2,6,1))
    entries.append((2,6,2))
    entries.append((1,direct_offsets[5],0))
    entries.append((1,direct_offsets[6],0))
    entries.append((1,xref_offset,0))
    xref_bytes = b"".join(struct.pack(">BIH", *entry) for entry in entries)
    xref_dict = b"<< /Type /XRef /Size 8 /Root 1 0 R /W [1 4 2] /Index [0 8] /Length %d >>" % len(xref_bytes)
    data.extend(b"7 0 obj\n" + xref_dict + b"\nstream\n" + xref_bytes + b"\nendstream\nendobj\n")
    data.extend(f"startxref\n{xref_offset}\n%%EOF\n".encode())
    (ROOT / "rune-object-stream.pdf").write_bytes(data)


def make_ghostscript() -> None:
    ps = ROOT / "ghostscript-source.ps"
    ps.write_text("""%!PS-Adobe-3.0\n%%Creator: RUNE corpus PostScript\n/Helvetica findfont 18 scalefont setfont\n72 720 moveto (Ghostscript producer fixture) show\n0.2 0.6 0.9 setrgbcolor 72 600 200 80 rectfill\nshowpage\n""", encoding="ascii")
    subprocess.run([
        "gs", "-q", "-dBATCH", "-dNOPAUSE", "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.7",
        "-dDetectDuplicateImages=true", "-dCompressFonts=true",
        f"-sOutputFile={ROOT / 'ghostscript-producer.pdf'}", str(ps)
    ], check=True)


def write_manifest() -> None:
    cases = [
        ("reportlab-subset-vectors-links.pdf", "ReportLab", ["simple", "subset-font", "vectors", "links"], "native-page", None),
        ("reportlab-alpha-transparency.pdf", "ReportLab/Pillow", ["alpha-image", "transparency", "vectors"], "native-page", None),
        ("reportlab-mixed-geometry.pdf", "ReportLab", ["mixed-page-sizes", "rotation", "original-dimensions"], "native-page", None),
        ("rune-type3-font.pdf", "RUNE manual PDF writer", ["type3-font", "vectors", "selectable-text"], "native-page", None),
        ("rune-object-stream.pdf", "RUNE manual PDF 1.5 writer", ["object-stream"], "visual", "unsupported-object-stream"),
        ("ghostscript-producer.pdf", "Ghostscript", ["different-producer", "vectors", "text", "object-stream"], "visual", "unsupported-object-stream"),
        ("reportlab-form.pdf", "ReportLab", ["forms"], "visual", "form-flatten-required"),
        ("reportlab-comment.pdf", "ReportLab", ["annotations", "comments"], "visual", "comment-flatten-required"),
        ("pypdf-signature.pdf", "pypdf", ["signatures"], "reject", "pdf-signature-rejected"),
        ("pypdf-attachment.pdf", "pypdf", ["attachments"], "reject", "pdf-attachment-rejected"),
        ("pypdf-javascript.pdf", "pypdf", ["javascript"], "native-page", None),
    ]
    manifest = {
      "schemaVersion":"1.0", "generatedBy":"generate_corpus.py", "generatedAt":"2026-07-27T00:00:00Z",
      "comparisonDimensions":["pixels","extractedText","pageCount","pageDimensions","pageBoxes","rotation","links","outputBytes","fonts","requestedMode","appliedMode","fallbackReason"],
      "cases":[{"file":f,"producer":producer,"coverage":coverage,"expectedOutcome":outcome,"expectedReason":reason} for f,producer,coverage,outcome,reason in cases]
    }
    (ROOT / "corpus.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    make_subset_vectors_links()
    make_alpha_transparency()
    make_mixed_geometry()
    make_form()
    make_comment()
    make_signature()
    make_attachment()
    make_javascript()
    make_type3()
    make_object_stream()
    make_ghostscript()
    write_manifest()

if __name__ == "__main__":
    main()
