# Daily lists

To make a draft from TierMaker, save a template's "Community Rank" page from your browser (Ctrl+S, "Webpage, Complete"), then run:

```
npm run import-page -- "<Community Rank page>.html" "<Create page>.html"
```

The second file is optional. It is the template's saved "Create" page, which is where TierMaker shows who made the template and whom it credits for the pictures. It writes `drafts/<template>.json`. Fill in any empty `label`, review it, set `day`, and move it here as `YYYY-MM-DD.json`.

Each approved day is one JSON file, named after its date, such as `2026-12-01.json`:

```json
{
  "day": "YYYY-MM-DD",
  "title": "<category>",
  "tiers": ["S", "A", "B", "C", "D"],
  "source": { "label": "<where the community ranking came from>", "url": "https://<its page>" },
  "author": { "name": "<who made the original tier list>", "url": "https://<their profile>" },
  "items": [
    {
      "slug": "<short-unique-id>",
      "label": "<name shown on the tile>",
      "imageUrl": "https://<image address>",
      "tier": 0,
      "credit": "<image author and licence>",
      "creditUrl": "https://<image source page>"
    }
  ]
}
```

- `tiers`: 2 to 10 names, best first.
- `tier` on each item: the answer, which is the community's tier for that item, counting from `0` at the top. It is never sent to the browser.
- `source`: credits the community ranking. It is shown under the list on the page.
- `author`: optional. Credits whoever made the original tier list template, on the line below `source`.

Publish an approved file with:

```
npm run publish-prompt -- prompts/YYYY-MM-DD.json
```

Past days cannot be changed, and neither can a day that already has guesses.

The files in `drafts/` are from the earlier Tierdle version. They have no `tiers` or answers, so they cannot be published as they are.
