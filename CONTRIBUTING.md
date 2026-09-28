# Contributing

Thanks for taking an interest. Issues and pull requests are welcome.

By contributing you agree that your work is licensed under the [MIT License](LICENSE).

## Running it locally

Full setup is in the [README](README.md#development). The one thing worth calling out here,
because it catches people out:

**The scripts and the server read different environment variables.** The `.mjs` scripts under
`scripts/` read `DB_PATH` and `REGISTRY_URL` directly. The Nuxt server reads Nuxt's runtime
config, which needs the `NUXT_` prefix, and anything under `public` needs `NUXT_PUBLIC_`. Passing
`DB_PATH` to `npm run dev` does nothing and you get "Cannot open database because the directory
does not exist".

You do not need a real registry to work on the UI. Seed the database with fake data instead:

```bash
DB_PATH="./.data/db/registry.db" node ./scripts/migrate-db.mjs
DB_PATH="./.data/db/registry.db" node ./scripts/seed-db.mjs

NUXT_DB_PATH="./.data/db/registry.db" \
  NUXT_PUBLIC_REGISTRY_PUBLIC_URL="localhost:5000" \
  NUXT_PUBLIC_REGISTRY_TITLE="Dev Registry" \
  npm run dev
```

If you point it at a real registry, take care not to put real image names into screenshots.

## Checking your change

There is no test runner and no linter. That puts the burden on you, so before opening a PR:

- `npm run build` succeeds
- The change works in **both light and dark mode**
- Both routes still work on a **hard load**, not only when reached by clicking through from the
  dashboard. `/repos/<name>` has broken this way before

## Conventions

`CLAUDE.md` carries the architecture and the full conventions. The ones most likely to come up:

- **Tailwind lives in `assets/css/main.css`**, registered globally in `nuxt.config.ts`. Do not
  import it from a component `<style>` block: it then compiles into that route's chunk and other
  routes render unstyled.
- **Dark mode is class-based**, via `@custom-variant dark` and a `theme` cookie, so SSR renders
  the right theme on the first response. Add `dark:` variants rather than overriding what the
  utilities mean. Two things to watch: anything already dark in light mode needs its own `dark:`
  value or it vanishes against the card, and `dark:border-gray-700` will silently override a
  `border-l-*` accent.
- **Icons are inline SVG**, `fill="none" stroke="currentColor" viewBox="0 0 24 24"`. No icon
  library.
- **npm with `save-exact=true`.** Commit the lockfile, and keep it in step with `package.json` or
  `npm ci` fails in the Docker build.
- **Every file ends with a newline.**

## Pull requests

Keep the change focused, and say what you verified. If it is a visual change, a before and after
screenshot helps a lot.

CI builds the Docker image on every pull request. It does not push one, so a red build means the
image genuinely failed to build. Pull requests from forks build without pushing and without the
image cache; that is expected.
