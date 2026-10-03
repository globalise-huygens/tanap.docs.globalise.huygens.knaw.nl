"""MkDocs hooks for search engines.

- Adds the page's canonical URL to the schema.org metadata in its front matter
  (`schema:`), which overrides/main.html outputs as JSON-LD.
- Sets <html lang> from the front matter (`language:`), so that the Dutch
  transcriptions are not marked as English. Material sets one language for
  the whole site, in a part of the template that cannot be overridden.
"""

import re

HTML_LANG = re.compile(r'<html lang="[^"]*"')


def on_page_markdown(markdown, page, config, files):
    schema = page.meta.get("schema")
    if isinstance(schema, dict) and "url" not in schema:
        schema["url"] = page.canonical_url
    return markdown


def on_post_page(output, page, config):
    language = page.meta.get("language")
    if language:
        output = HTML_LANG.sub(f'<html lang="{language}"', output, count=1)
    return output
