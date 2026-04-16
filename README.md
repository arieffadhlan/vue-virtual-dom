# .

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Vue (Official)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Recommended Browser Setup

- Chromium-based browsers (Chrome, Edge, Brave, etc.):
    - [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
    - [Turn on Custom Object Formatter in Chrome DevTools](http://bit.ly/object-formatters)
- Firefox:
    - [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
    - [Turn on Custom Object Formatter in Firefox DevTools](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
bun install
```

### Compile and Hot-Reload for Development

```sh
bun run dev
```

### Type-Check, Compile and Minify for Production

```sh
bun run build
```

### Run Unit Tests with [Vitest](https://vitest.dev/)

```sh
bun run test:unit
```

### Lint with [ESLint](https://eslint.org/)

```sh
bun run lint
```

## Docker Setup

Build and run locally with Docker:

```sh
bun run docker:build
bun run docker:run
```

Or use Docker Compose:

```sh
bun run docker:up
```

App URL: `http://localhost:8080`

Stop compose:

```sh
bun run docker:down
```

## CI/CD Setup

GitHub Actions workflows are included:

- `CI`: `.github/workflows/ci.yml`
- `CD Docker`: `.github/workflows/cd-docker.yml`

CI runs type-check, lint, unit test, and build on push + pull request.

CD builds and pushes Docker images to GHCR (`ghcr.io`) on:

- push to `main`
- tag push matching `v*`
- manual `workflow_dispatch`

Required for container publish:

- GitHub Packages permission (`packages: write`) is already declared in the workflow.
- Repository Actions must be enabled.

```

```
