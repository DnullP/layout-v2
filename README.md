# layout-v2

Independent React layout engine extracted from `ofive`.

## Included

- Section tree model and React controller
- Recursive layout renderer with split and resize support
- Activity bar and tab-section examples
- Bun unit tests and Playwright regression coverage

## Local Development

```bash
npm install
npm run dev
```

The demo app runs on `http://127.0.0.1:4175`.

## Build

```bash
npm run build
```

This generates `dist/index.js` and `dist/index.cjs` for GitHub-based package consumption.

## Tests

```bash
bun test
npm run test:e2e
```

## Package Consumption

After pushing to GitHub, install it in another project with a Git dependency, for example:

```bash
npm install github:<owner>/layout-v2
```