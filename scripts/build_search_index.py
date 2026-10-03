"""Build the Pagefind search indexes for the built MkDocs site.

Run after `mkdocs build`:

    python scripts/build_search_index.py [site_dir]

Writes three independent indexes, so that each search only downloads the
index chunks it needs:

- site/pagefind/site/                 all pages except the transcriptions,
                                      plus the PDFs linked from the pages
- site/pagefind/council-of-policy/    Council of Policy transcriptions
- site/pagefind/orphan-chamber/       Orphan Chamber transcriptions

Text extracted from the PDFs is cached in .cache/pdf-text/, keyed on the
file's hash, because extraction takes a few minutes.
"""

import asyncio
import hashlib
import html
import json
import re
import sys
from pathlib import Path

import pagefind.service
from pagefind.index import PagefindIndex
from pypdf import PdfReader


class _NoPollDelay:
    """The Pagefind Python API sleeps 0.1 s before reading each response from
    the Pagefind process, which limits indexing to 10 records per second (the
    Orphan Chamber alone has 5,400). The read after the sleep already waits for
    data, so the sleep can be skipped. If a future version of the API no longer
    sleeps, this changes nothing."""

    def __getattr__(self, name):
        return getattr(asyncio, name)

    @staticmethod
    async def sleep(delay, result=None):
        return await asyncio.sleep(0, result)


pagefind.service.asyncio = _NoPollDelay()

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"
CACHE = ROOT / ".cache" / "pdf-text"

# Only index the page content, not navigation, header and footer.
ROOT_SELECTOR = "article.md-content__inner"
EXCLUDE_SELECTORS = [".headerlink", ".md-source-file", ".md-content__button"]
ARTICLE_OPEN = '<article class="md-content__inner md-typeset">'

COLLECTIONS = {
    "council-of-policy": "cape-transcriptions/Council-of-Policy/TKF3_",
    "orphan-chamber": "cape-transcriptions/Orphan-Chamber/MOOC8/",
}

SECTIONS = {
    "archival-inventories/": "Archival Inventories",
    "tanap-index-establishment-reconstructions/": "Index and Establishment Reconstructions",
    "cape-transcriptions/": "Cape of Good Hope Transcriptions",
}

MD_HEADING = re.compile(r"^#{1,6}\s+(.*)$")
H2_SPLIT = re.compile(r'(?=<h2 id=")')
H2 = re.compile(r'<h2 id="([^"]+)"[^>]*>(.*?)</h2>', re.S)
TAGS = re.compile(r"<[^>]+>")
HEADERLINK = re.compile(r'<a class="headerlink".*?</a>', re.S)
# Person names are marked with a green dotted underline in the transcriptions
PERSON = re.compile(r'<span style="border-bottom: 2px dotted #00FF00;">(.*?)</span>', re.S)
PDF_CHUNK = 50

MD_PDF_LINK = re.compile(r"\[((?:[^\[\]]|\\\[|\\\])+)\]\(([^)\s]+\.pdf)\)")


def section_of(rel: str) -> str:
    for prefix, name in SECTIONS.items():
        if rel.startswith(prefix):
            return name
    return "Home"


def page_url(rel: str) -> str:
    """docs-relative path of a built page -> URL from the site root."""
    if rel == "index.html":
        return "/"
    return "/" + rel.removesuffix("index.html")


def plain(markdown: str) -> str:
    """Strip the bits of Markdown that occur in link texts and headings."""
    text = html.unescape(re.sub(r"<br\s*/?>", " ", markdown))
    text = re.sub(r"\\(.)", r"\1", text)
    text = re.sub(r"[*_`]", "", text)
    text = re.sub(r"^\d+\.\s+", "", text)
    return re.sub(r"\s+", " ", text).strip()


def linked_pdfs() -> dict[Path, dict]:
    """Find the PDFs that are linked from a Markdown page, with link text and context."""
    pdfs = {}
    for md in sorted(DOCS.rglob("*.md")):
        heading = None
        for line in md.read_text(encoding="utf-8").splitlines():
            if m := MD_HEADING.match(line):
                heading = plain(m.group(1))
            for text, href in MD_PDF_LINK.findall(line):
                pdf = (md.parent / href).resolve()
                if pdf.is_file() and pdf not in pdfs:
                    pdfs[pdf] = {"text": plain(text), "context": heading}
    return pdfs


def pdf_pages(pdf: Path) -> list[str]:
    data = pdf.read_bytes()
    cached = CACHE / (hashlib.sha256(data).hexdigest() + ".json")
    if cached.exists():
        return json.loads(cached.read_text(encoding="utf-8"))
    pages = [(page.extract_text() or "") for page in PdfReader(pdf).pages]
    CACHE.mkdir(parents=True, exist_ok=True)
    cached.write_text(json.dumps(pages), encoding="utf-8")
    return pages


def record_html(title: str, filters: dict[str, str], body: str) -> str:
    """A minimal page in the shape ROOT_SELECTOR expects, for records we compose ourselves."""
    return (
        f"<html><body>{ARTICLE_OPEN}{filter_tags(filters)}"
        f"<h1>{html.escape(title)}</h1>{body}</article></body></html>"
    )


def pdf_records(url: str, title: str, section: str, pages: list[str]):
    """Split PDF text into records of PDF_CHUNK pages, with a heading per page.

    The heading ids become the anchors of Pagefind's sub-results, so a hit
    on page 12 links to file.pdf#page=12, which PDF viewers open at that page.
    Splitting keeps each record small: Pagefind's excerpt calculation slows
    down with the number of headings times the length of a record.
    """
    for start in range(0, len(pages), PDF_CHUNK):
        chunk = pages[start : start + PDF_CHUNK]
        body = "".join(
            f'<h2 id="page={n}">Page {n}</h2><p>{html.escape(text)}</p>'
            for n, text in enumerate(chunk, start=start + 1)
            if text.strip()
        )
        if not body:
            continue
        chunk_title = title
        if len(pages) > PDF_CHUNK:
            chunk_title += f" (pp. {start + 1}–{start + len(chunk)})"
        yield (
            f"{url}#page={start + 1}",
            record_html(chunk_title, {"Section": section, "Type": "PDF"}, body),
        )


def item_records(page: str, url: str, filters: dict[str, str]):
    """Split an Orphan Chamber page into one record per item (## MOOC8/x.y).

    The pages hold up to a few hundred items each, too many to compute
    excerpts for quickly. As separate records, each item is its own result,
    linking to its heading on the page.
    """
    start = page.index(ARTICLE_OPEN) + len(ARTICLE_OPEN)
    article = page[start : page.rindex("</article>")]
    for section in H2_SPLIT.split(article)[1:]:
        heading = H2.match(section)
        anchor = heading.group(1)
        title = plain(TAGS.sub("", HEADERLINK.sub("", heading.group(2))))
        if person := PERSON.search(section):
            title += " · " + plain(TAGS.sub("", person.group(1)))
        body = section[heading.end() :]
        yield f"{url}#{anchor}", record_html(title, filters, body)


def filter_tags(filters: dict[str, str]) -> str:
    """Empty elements carrying Pagefind filters; values in the attribute stay out of the text."""
    return "".join(
        f'<span data-pagefind-filter="{name}:{html.escape(value)}"></span>'
        for name, value in filters.items()
    )


def with_filters(page: str, filters: dict[str, str]) -> str:
    """Add Pagefind filters to the start of a built page's article."""
    if ARTICLE_OPEN not in page:
        raise ValueError("page has no Material article element")
    return page.replace(ARTICLE_OPEN, ARTICLE_OPEN + filter_tags(filters), 1)


def volume_group(rel: str) -> str:
    """cape-transcriptions/Council-of-Policy/TKF3_C001-C010/... -> 'C001–C010'."""
    return rel.split("/")[2].removeprefix("TKF3_").replace("-", "–")


def mooc_items(rel: str) -> str:
    """cape-transcriptions/Orphan-Chamber/MOOC8/MOOC8_1-5/... -> 'MOOC8/1–5'."""
    return rel.split("/")[3].replace("_", "/").replace("-", "–")


def new_index(language: str, output: Path) -> PagefindIndex:
    return PagefindIndex(
        config={
            "root_selector": ROOT_SELECTOR,
            "exclude_selectors": EXCLUDE_SELECTORS,
            "force_language": language,
            "output_path": str(output),
        }
    )


async def build_site_index(site: Path, pages: list[Path]) -> None:
    async with new_index("en", site / "pagefind" / "site") as index:
        for path in pages:
            rel = path.relative_to(site).as_posix()
            if any(rel.startswith(prefix) for prefix in COLLECTIONS.values()):
                continue
            content = with_filters(
                path.read_text(encoding="utf-8"),
                {"Section": section_of(rel), "Type": "Web page"},
            )
            await index.add_html_file(content=content, url=page_url(rel))

        pdfs = linked_pdfs()
        for n, (pdf, link) in enumerate(pdfs.items(), start=1):
            rel = pdf.relative_to(DOCS).as_posix()
            print(f"  PDF {n}/{len(pdfs)}: {rel}", flush=True)
            title = link["text"]
            if link["context"]:
                title += f" — {link['context']}"
            records = pdf_records("/" + rel, title, section_of(rel), pdf_pages(pdf))
            for url, content in records:
                await index.add_html_file(content=content, url=url)


async def build_collection_index(
    site: Path, pages: list[Path], name: str, prefix: str
) -> None:
    async with new_index("nl", site / "pagefind" / name) as index:
        for path in pages:
            rel = path.relative_to(site).as_posix()
            if not rel.startswith(prefix):
                continue
            page = path.read_text(encoding="utf-8")
            if name == "council-of-policy":
                content = with_filters(page, {"Volumes": volume_group(rel)})
                await index.add_html_file(content=content, url=page_url(rel))
            else:
                records = item_records(page, page_url(rel), {"Items": mooc_items(rel)})
                for url, content in records:
                    await index.add_html_file(content=content, url=url)


async def main(site: Path) -> None:
    pages = sorted(p for p in site.rglob("index.html") if "pagefind" not in p.parts)
    if not pages:
        sys.exit(f"No pages found in {site}; run `mkdocs build` first.")
    print("Building site index (pages and linked PDFs)")
    await build_site_index(site, pages)
    for name, prefix in COLLECTIONS.items():
        print(f"Building {name} index")
        await build_collection_index(site, pages, name, prefix)


if __name__ == "__main__":
    asyncio.run(main(Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "site").resolve()))
