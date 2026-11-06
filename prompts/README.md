# Daily prompts

Unapproved lists wait in `drafts/`. Open `drafts/review.html` to check them.

Each approved day is one JSON file, named after its date, such as `2026-11-03.json`:

```json
{
  "day": "YYYY-MM-DD",
  "title": "<category>",
  "items": [
    {
      "slug": "<short-unique-id>",
      "label": "<name shown on the tile>",
      "imageUrl": "https://<image address>",
      "credit": "<author and licence>",
      "creditUrl": "https://<image source page>"
    }
  ]
}
```

Publish an approved file with:

```
npm run publish-prompt -- prompts/YYYY-MM-DD.json
```

A day cannot be published once it has posts, and past days cannot be changed.
