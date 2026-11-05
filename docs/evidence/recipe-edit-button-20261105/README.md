# Recipe edit button

The recipe detail view adds a `레시피 수정` button. The button carries the selected recipe id and shows `레시피 수정 기능을 준비 중입니다.` through the existing status message. It does not open a form or change recipe data.

The recipe detail action row already owns the recipe id and the delegated click handler. Extending that row keeps the button in the existing action flow. A separate form would add editing state and save behavior outside the requested first step.

## Verification

| Command | Result |
| --- | --- |
| `node --test --test-name-pattern='recipe detail (groups conditions|edit action|places the guide)' test/pwa-ui.view.test.mjs` | 3 passed, 0 failed |
| `npm test` | 732 passed, 0 failed. Ran outside the sandbox because HTTP tests bind temporary servers on `127.0.0.1`. |
| `npm run build:pages` | Passed. Build id `251ef24c4066`. |
| `npm run check:pages` | Passed. |

The first sandboxed `npm test` run hit `listen EPERM` in HTTP tests. The successful run used the permitted elevated execution. The Worker did not run the browser check. The Critic will verify the 390 px and 1440 px layouts.

## Changed files

- `pwa/ui/view.mjs` adds the detail action and status message handler.
- `test/pwa-ui.view.test.mjs` checks the recipe id, status message, unchanged route and data, and existing detail actions.

The change uses the Worker configuration `gpt-6-luna` with `max` reasoning effort.
