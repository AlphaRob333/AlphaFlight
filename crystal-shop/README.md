# Crystal shop — Shopify theme

A Shopify Online Store 2.0 theme for a crystal shop. The home page asks the
shopper to choose between two ways of shopping the same catalogue:

- **Metaphysical** — dark, atmospheric look; products show intention, chakra,
  zodiac and element.
- **Mineral** — light, specimen-label look; products show formula, Mohs
  hardness, crystal system, mineral class and locality.

The choice is remembered in the browser, restyles the whole store, and can be
switched at any time from the header. It is also saved on the order as a cart
attribute named `Experience`.

## Preview without Shopify

Open `preview/index.html` in a browser. It is a static copy of the home page
that loads the theme's real CSS and JavaScript. Other pages need Shopify.

## Launching on Shopify

This folder is the theme root. Either:

- **Shopify CLI:** `shopify theme dev --path crystal-shop --store your-store.myshopify.com`
  to preview with live data, then `shopify theme push --path crystal-shop`.
- **Zip upload:** zip the *contents* of this folder (without `preview/`) and
  upload under Online Store → Themes → Add theme.

Shopify's GitHub integration expects the theme at the root of a branch, so to
use it, move this folder's contents to their own repository or branch.

## Store setup

1. **Collections.** In the theme editor, open the home page's *Experience
   gateway* section and pick the collection each panel opens. Left empty, both
   open all products.
2. **Menus.** The header uses the `main-menu` menu and the footer uses `footer`.
3. **Product metafields.** Create these product metafields (Settings → Custom
   data → Products) in the `custom` namespace. All are optional; empty rows are
   hidden.

   | Key | Type | Shown in |
   | --- | --- | --- |
   | `intention` | Single line text | Metaphysical |
   | `chakra` | Single line text | Metaphysical |
   | `zodiac` | Single line text | Metaphysical |
   | `element` | Single line text | Metaphysical |
   | `metaphysical_notes` | Rich text or multi-line text | Metaphysical |
   | `mineral_formula` | Single line text | Mineral |
   | `mohs_hardness` | Single line text | Mineral |
   | `crystal_system` | Single line text | Mineral |
   | `mineral_class` | Single line text | Mineral |
   | `locality` | Single line text | Mineral |
   | `specimen_notes` | Rich text or multi-line text | Mineral |

4. **Colors and fonts.** Theme settings → *Experiences* holds the palette for
   each experience and which one shows before a shopper has chosen.

## Mining game (mineral side)

`sections/mine.liquid` is a "mine your own" game: the shopper picks a dig site
on a world map, breaks rocks, and uncovers real in-stock products from that
site, each with its price and an add-to-cart button. Playing is free and
nothing is bought or reserved until the shopper adds a find to the cart.
Finds are kept in a field log in the shopper's browser.

To switch it on:

1. Create one collection per dig site (Brazil, Morocco, Libyan Desert,
   Pakistan, India) and put that site's products in it. Set each product's
   *Product type* to the mineral name (for example `Amethyst`); the game shows
   it as the species.
2. Create a page (for example "Mine") and give it the `mine` template.
3. In the theme editor, open that page and pick the collection for each dig
   site block. Sites, text, map position and colors are all editable, and new
   sites can be added as blocks.
4. On the home page's *Experience gateway* section, set the mineral panel's
   "Or link to a page" to the Mine page.

Only in-stock products appear, up to 50 per site. A site with no stock shows a
"nothing in stock" note instead of a rock face. `preview/mine.html` is a
static demo with sample specimens (placeholder names and prices).

## How the experience switch works

- `layout/theme.liquid` sets `<html data-experience="…">` from the saved choice
  before the page paints. A link with `?experience=mineral` (or
  `metaphysical`) also sets it, which is useful for ads and emails.
- `assets/experience.js` handles anything with a `data-set-experience`
  attribute (the home page panels and the header switch).
- `assets/base.css` hides `.only-metaphysical` / `.only-mineral` content for
  the other experience.

## Not included yet

Customer account templates (Shopify's hosted accounts work without them),
gift card template, collection filters, and a cart drawer.
