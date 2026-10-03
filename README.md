# docs.globalise.huygens.knaw.nl/tanap

Static website for GLOBALISE Docs at [https://docs.globalise.huygens.knaw.nl/tanap](https://docs.globalise.huygens.knaw.nl/tanap).

On this website, the [GLOBALISE project](https://globalise.huygens.knaw.nl/) presents a selection of materials that were once available on the TANAP website, ensuring continued access to important resources for researchers and the public. 

## Branches

- The main branch contains the files that Material for MkDocs processes to generate the static site.
- The [gh-pages branch](https://github.com/globalise-huygens/tanap.docs.globalise.huygens.knaw.nl/tree/gh-pages) contains the static site.
- The [source-files branch](https://github.com/globalise-huygens/tanap.docs.globalise.huygens.knaw.nl/tree/source-files) contains the files shared by the National Archives of the Netherlands in January 2025, a script that converts these to Markdown format, and a 2018 Web Archive image of the former TANAP website.

## Development
These static pages are generated with [Material for MkDocs](https://squidfunk.github.io/mkdocs-material/) using a GitHub Action on every push (see the [`gh-pages`](https://github.com/globalise-huygens/docs.globalise.huygens.knaw.nl/tree/gh-pages) branch). For local development, follow the instructions below.

### Local development

#### Prerequisites

Make sure that you have python 3.8 or higher installed. Then install the dependencies:

```bash
$ pip install -r requirements.txt
```

#### Run the development server

Local changes are immediately reflected in the browser when running the development server:

```bash
$ mkdocs serve
```

Building the site can be done with:

```bash
$ mkdocs build
```

#### Search

Search uses [Pagefind](https://pagefind.app/) instead of the built-in MkDocs search, so that visitors only download the parts of the index they need. The indexes are built after `mkdocs build`, and are not available in `mkdocs serve`. To try search locally:

```bash
$ mkdocs build
$ python scripts/build_search_index.py
$ python -m http.server -d site
```

The script builds three separate indexes in `site/pagefind/`:

- `site`: all pages except the transcriptions, plus the text of the PDFs linked from the pages (opened from the search button in the header);
- `council-of-policy` and `orphan-chamber`: the Cape of Good Hope transcriptions, searched on the [transcription search page](docs/cape-transcriptions/search.md).

Extracting the PDF text takes a few minutes the first time; the result is cached in `.cache/pdf-text/`. The GitHub Action runs the same steps before deploying to the `gh-pages` branch.



