# docs.globalise.huygens.knaw.nl/tanap

Static website for GLOBALISE Docs at [https://docs.globalise.huygens.knaw.nl/tanap](https://docs.globalise.huygens.knaw.nl/tanap).

On this website, the [GLOBALISE project](https://globalise.huygens.knaw.nl/) presents a selection of materials that were once available on the TANAP website, ensuring continued access to important resources for researchers and the public. 

## Branches

- The main branch contains the files that Material for MkDocs processes to generate the static site.
- The gh-pages branch contains the static site.
- The source-files branch contains the files shared by the National Archives of the Netherlands in January 2025, a script that converts these to Markdown format, and a 2018 Web Archive image of the former TANAP website.

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



