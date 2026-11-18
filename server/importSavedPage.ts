// Turns a TierMaker "Community Rank" page that you saved from your own browser into a draft list file.
// It only reads the saved file on your computer. It never contacts TierMaker.
// Usage: npm run import-page -- "<Community Rank page>.html" ["<Create page>.html"]
// The optional second file is the template's saved "Create" page, which is where TierMaker shows
// who made the template and whom the template credits for its pictures.
// Writes prompts/drafts/<template>.json, for you to review before publishing.
import { mkdirSync, writeFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { MAX_TIERS, MIN_TIERS } from '../shared/types.js';

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

// The few HTML entities that appear in tier names and titles.
function unescapeHtml(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_m, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

// "mint-chocolate-chip.png" -> "Mint Chocolate Chip". Screenshot-style names give "", meaning
// the name is only inside the picture and must be filled in by hand.
function labelFromFile(file: string): string {
  const base = decodeURIComponent(file)
    .replace(/\.(png|jpe?g|gif|webp)$/i, '')
    .replace(/(png|jpe?g|gif|webp)$/i, '') // TierMaker often adds the old extension, as in "nycjpg.png"
    .replace(/[-_]?\d+$/, ''); // and a number, as in "wintermelon1png.png"
  // Names that carry no information, such as "image-2", "33" or a screenshot's date.
  if (!base || /screen-?shot|^(image|img|photo|pic)$|^\d|^zz\d+/i.test(base)) return '';
  return base
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function slugFrom(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const path = process.argv[2] ?? fail('Give the path of a saved TierMaker Community Rank page (.html).');
const html = readFileSync(path, 'utf8');

// Where the page was saved from. Browsers write this comment at the top of a saved page.
const savedFrom = html.match(/saved from url=\(\d+\)(\S+)/)?.[1] ?? '';
const templateKey = savedFrom.match(/tiermaker\.com\/(?:categories\/[^/]+|create)\/([^/?#\s]+)/)?.[1] ?? '';

if (/tiermaker\.com\/create\//.test(savedFrom) || /<title>\s*Create a /i.test(html)) {
  fail(
    'This is the "Create" page, which has no community ranking.\n' +
      'Open the template\'s "Community Rank" page instead, wait until the tiers fill with pictures,\n' +
      'then save it with Ctrl+S as "Webpage, Complete".',
  );
}
if (!/Community Rank/i.test(html)) fail('This does not look like a TierMaker Community Rank page.');

// The ranking is drawn as rows: <div class="tier-row"> <div class="label-holder"><span class="label">S</span>
// <div class="tier sort"> <div class="character" style="background-image: url(...)">...
// The unplaced pool comes after the rows, so the last row stops there.
const container = html.indexOf('id="tier-container"');
if (container < 0) fail('No tier list found. Wait for the ranking to appear before saving the page.');
const poolStart = html.indexOf('char-tier-container', container);
const rowsHtml = html.slice(container, poolStart > 0 ? poolStart : undefined);
const rowChunks = rowsHtml.split(/<div[^>]*class="tier-row[^"]*"[^>]*>/).slice(1);

const imagesOf = (chunk: string) =>
  [...chunk.matchAll(/class="character[^"]*"[^>]*background-image:\s*url\((?:&quot;|["'])?([^"')&]+)/g)].map(
    (match) => match[1],
  );

const tiers = rowChunks.map((chunk) => unescapeHtml(chunk.match(/class="label"[^>]*>([\s\S]*?)<\/span>/)?.[1] ?? '').trim());
const placedRows = rowChunks.map(imagesOf);
const unplaced = poolStart > 0 ? imagesOf(html.slice(poolStart)) : [];

if (tiers.length < MIN_TIERS || tiers.length > MAX_TIERS) fail(`Found ${tiers.length} tiers; expected ${MIN_TIERS} to ${MAX_TIERS}.`);
if (placedRows.flat().length === 0) fail('No items are placed in the tiers. Wait for the ranking to appear before saving.');

// A saved page may point images at its local "_files" folder; map those back to TierMaker's address.
const basePath = html.match(/baseTierImagePath\s*=\s*"([^"]+)"/)?.[1] ?? '';
function absoluteUrl(src: string): string {
  if (src.startsWith('https://')) return src;
  if (src.startsWith('/')) return `https://tiermaker.com${src}`;
  return `https://tiermaker.com${basePath}/${src.split('/').pop()}`; // a local copy, such as ./Page_files/x.png
}

// From the Create page, if given: the template's author, and the template's own credit for its pictures,
// such as "Credit to https://www.friendlys.com/... for the images".
let author: { name: string; url: string } | undefined;
let imageCredit = { credit: 'Image from TierMaker', creditUrl: savedFrom };
const createPath = process.argv[3];
if (createPath) {
  const createHtml = readFileSync(createPath, 'utf8');
  const meta = createHtml.slice(Math.max(0, createHtml.indexOf('author-meta-container')));
  const profile = meta.match(/href="(https:\/\/tiermaker\.com\/user\/[^"]+)"/)?.[1];
  const name = meta.match(/data-screen-name="([^"]+)"/)?.[1]; // the author's name in their follow button
  if (profile && name) author = { name: unescapeHtml(name), url: profile };
  else console.log('No template author found on the Create page.');

  const credit = createHtml.match(/<p>\s*Credit to\s*<a[^>]*href="(https:\/\/[^"]+)"[^>]*>[\s\S]*?<\/a>\s*for the images/i);
  if (credit) {
    const site = new URL(credit[1]).hostname.replace(/^www\./, '');
    imageCredit = { credit: `${site}, as credited by the template on TierMaker`, creditUrl: credit[1] };
  }
}

const usedSlugs = new Set<string>();
const items = placedRows.flatMap((images, tier) =>
  images.map((src, position) => {
    const file = src.split('/').pop() ?? '';
    const label = labelFromFile(file);
    let slug = slugFrom(label) || `item-${tier}-${position + 1}`;
    while (usedSlugs.has(slug)) slug += '-2';
    usedSlugs.add(slug);
    return { slug, label, imageUrl: absoluteUrl(src), tier, ...imageCredit };
  }),
);

const listCount = html.match(/from ([\d,]+) submitted tier lists/)?.[1];
const pageTitle = unescapeHtml(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '').trim();
const title = pageTitle.replace(/\s*-\s*TierMaker\s*$/i, '').replace(/\s*\(Community Rankings?\)\s*/i, '').replace(/\s*Tier List\s*$/i, '');

const draft = {
  day: '',
  title,
  tiers,
  source: {
    label: `TierMaker community ranking${listCount ? ` (${listCount} lists)` : ''}`,
    url: savedFrom,
  },
  ...(author && { author }),
  items,
};

mkdirSync('prompts/drafts', { recursive: true });
const out = `prompts/drafts/${templateKey || slugFrom(title)}.json`;
writeFileSync(out, JSON.stringify(draft, null, 2) + '\n');

console.log(`Wrote ${out}: "${title}", ${tiers.length} tiers, ${items.length} items.`);
tiers.forEach((name, index) => console.log(`  ${name || '(no name)'}: ${placedRows[index].length} items`));
console.log(author ? `  Template by ${author.name}` : '  No template author: give the Create page as a second file to add one.');
const unnamed = items.filter((item) => !item.label).length;
if (unnamed) console.log(`${unnamed} items have no name: their names are only inside the pictures. Fill in each "label".`);
if (unplaced.length) console.log(`${unplaced.length} items were left unranked by the community and are not included.`);
if (tiers.some((name) => !name)) console.log('Some tiers have no name. Give each one a name.');
