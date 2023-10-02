# lab.globalise.huygens.knaw.nl
![GLOBALISE Lab](docs/static/globalise_lab.svg)
Static website for our GLOBALISE Lab at [http://lab.globalise.huygens.knaw.nl/](http://lab.globalise.huygens.knaw.nl/).

## Development
These static pages are generated with [Material for MkDocs](https://squidfunk.github.io/mkdocs-material/) using a GitHub Action on every push (see the [`gh-pages`](https://github.com/globalise-huygens/lab.globalise.huygens.knaw.nl/tree/gh-pages) branch). For local development, follow the instructions below.

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



