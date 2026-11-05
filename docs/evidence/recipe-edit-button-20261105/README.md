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

The first sandboxed `npm test` run hit `listen EPERM` in HTTP tests. The successful run used the permitted elevated execution. The Worker did not run the browser check. The Critic independently verified the 390 px and 1440 px Chrome layouts, the notification, unchanged route and detail content, existing actions, and no horizontal overflow or page errors. The Critic used `gpt-6.1-sol` with `medium` reasoning effort.

## Changed files

- `pwa/ui/view.mjs` adds the detail action and status message handler.
- `test/pwa-ui.view.test.mjs` checks the recipe id, status message, unchanged route and data, and existing detail actions.

The change uses the Worker configuration `gpt-6-luna` with `max` reasoning effort.

## Publication

[Pages deployment](https://github.com/kangseokgyu/bean-pocket/actions/runs/41968002339) succeeded for commit `a3d7e49c4f7a20029fcd2b2d2c2e273217303711` with `probes=false`. The verified source was fast-forwarded to main without source changes.

The public app is https://kangseokgyu.github.io/bean-pocket/ with build `251ef24c4066`. The public index, view module, app module, stylesheet, manifest, and service worker returned HTTP 200 and matched the local build bytes. See [public verification](public-verification.json).

Chrome screenshots are [390 px](recipe-edit-390.png) and [1440 px](recipe-edit-1440.png). A physical iPhone and real Notion data were not tested.
