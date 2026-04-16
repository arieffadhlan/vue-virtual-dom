📘 Vue Company Standard — Handbook
Standard guide for initializing and developing Vue Projects in BTJ.

🏛️ Pillars of Excellence

1. Tech Stack & Libraries — Standardized Tools, Accelerated Delivery.
2. Modular Architecture — Clear Naming, Precise Grouping.
3. Quality Governance — Clean Code: Format-Perfect & Warning-Free to Avoid Conflicts.
4. Ship & Secure — Production-Ready: Engineered for Stability and Security.

1️⃣ Tech Stack & Libraries

Foundation

Category
Tool

Core
Vue 3 (Composition API), TypeScript (Strict Mode)

State
Pinia

HTTP
Axios (with centralized interceptors)

Styling

Category
Tool

Core
TailwindCSS

Internal Library
BangunindoUI (`@bangunindo/btj-ui`)

Suggested
Hybrid Styling: SASS (SCSS) with CSS Vars

Suggested More Extensions

Need
Library

Date-Time
Day.js

Chart
Apache ECharts

Map
Google Map API

Canvas
VueFlow

Rict-text
TipTap

Code Editor
CodeMirror

2️⃣ Modular Architecture

Folder Structure — Domain Driven

Group by Module.

src/
├── app/
│ ├── api/
│ ├── constants/
│ ├── types/
│ └── ...
├── components/
│ ├── common/
│ └── ...
├── layouts/
│ └── ...
├── router/
├── modules/
│ ├── feature#1/
│ │ ├── api/
│ │ ├── components/
│ │ ├── composables/
│ │ ├── store/
│ │ ├── types/
│ │ └── views/
│ ├── feature#2/
│ │ ├── api/
│ │ ├── components/
│ │ ├── views/
│ │ └── ...
│ └── ...
└── App.vue

Folder Structure — Atomic Driven (Recommended)

Group by Component Usage.

src/
├── app/
│ ├── api/
│ ├── constants/
│ ├── types/
│ └── ...
├── assets/
├── components/
│ ├── app/
│ ├── form/
│ ├── modal/
│ └── ...
├── composables/
├── store/
├── router/
├── utils/
├── views/
│ ├── feature_1/
│ │ └── index.vue
│ ├── feature_2/
│ │ └── index.vue
│ └── ...
└── App.vue

Please Notes

- Folder Name → Always use lowercase for folder.
- Flat Hierarchy → Limited nesting folder (max 3~4 level).

3️⃣ Naming Convention

Summary

Category
File Type
Naming Format
Case Style
Example

Components
`.vue`
SemanticNaming
PascalCase
`LoginModal.vue`, `UserTable.vue`

Feature Logic
`.ts`
`{feature}.{group}`
kebab-case
`auth.api.ts`, `audit.store.ts`, `user.type.ts`

Composables
`.ts`
`use{Function}`
camelCase
`useScreenReader.ts`, `useDarkMode.ts`

Functional-File Format

Naming by Functionality.
File name describes its content (e.g. `ProfileCard.vue` not `Card_1.vue`).
Format : Semantic Naming, PascalCase.

src/components/
├── modal/
│ └── LoginModal.vue
├── card/
│ └── ProfileCard.vue
├── table/
│ └── UserTable.vue

Feature-First Format

Naming by its Feature.
Format : `{feature}.{feature-group}.ts`, kebab-case.

src/app/types/
└── auth.type.ts
src/app/stores/
└── auth.store.ts
ars/app/api/
└── auth.api.ts

Use-Hook Format

Composable Naming Rules.
Format : `use{Function}.ts`, camelCase.

src/composables/
├── useScreenReader.ts
└── useDynamicDarkMode.ts

⚠️ Suggested: Avoid `index.vue`

For a better debugging experience, avoid using `index.vue` for views files. Use Functional-File Naming instead.

src/views/user/
├── index.vue ✖
└── UserView.vue ✔

4️⃣ Quality Governance

🔍 The Inspector — ESLint (Linter)

Scans for bugs, kills warnings, and keeps our logic solid before running.

{
"no-unused-vars": "off",
"@typescript-eslint/no-unused-vars": ["warn"],
"no-console": "process.env.NODE_ENV === 'production' ? 'error' : 'warn'",
"no-debugger": "error",
"no-undef": "error",
"vue/multi-word-component-names": "warn",
"vue/no-unused-vars": "error",
"vue/script-setup-uses-vars": "error"
}

🎨 The Artist — Prettier (Formatter)

Keep it clean, readable, and looking professional.

{
"semi": false,
"singleQuote": true,
"tabWidth": 4,
"trailingComma": "es5",
"printWidth": 100,
"bracketSpacing": true,
"arrowParens": "always"
}

🛡️ The Guard — Pre-Commit (Husky + Lint-Staged)

Makes sure only clean, perfect code actually hits the repo.

- Husky — Git hooks automation
- Lint-Staged — Runs linter only on staged files

5️⃣ Ship & Secure

🧪 All-Ready

⚠️ All builds must be verified and run in Production Mode to ensure performance and reliability in real-world scenarios.

Type
Tool

Unit Tests
Vitest + Happy DOM

End-to-End (E2E) Tests
Playwright

🐳 Infra-Friendly

- Use Dockerfile for every project
- Server Awareness: Know your server specs to ensure everything runs smooth

⚠️ Linux is case-sensitive. Watch your file naming or your build will break!

🔒 Compliance

Version Lock

"axios": "~1.7.4" ✖
"axios": "^1.7.4" ✖
"axios": "1.7.4" ✔

Strict Ignore Rules

Configure .gitignore properly.

Zero Exposure

Make sure all secret keys not exposed in public.

Commit Message Format

feat : feature updates
fix : bug fixing
chore : foundation updates
docs : documentation

Examples:

git commit -m "feat: add node to canvas"
git commit -m "fix: resolve feature on dark mode"
git commit -m "chore: update library"
git commit -m "docs: add README"

✅ Project Initialization Checklist

- Vue 3 + TypeScript (Strict Mode) installed.
- Pinia configured as state management.
- Axios configured with centralized interceptors.
- TailwindCSS + BangunindoUI installed.
- Folder structure follows standard (Domain/Atomic Driven).
- ESLint configured with standard rules.
- Prettier configured with standard rules.
- Husky + Lint-Staged installed and running.
- Vitest + Happy DOM ready for unit testing.
- Playwright ready for E2E testing (optional).
- Dockerfile available.
- .gitignore configured properly.

📌 We will continuously refine this document as our team grows and our tech stack evolves.
