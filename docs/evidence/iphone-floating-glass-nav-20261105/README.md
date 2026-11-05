# Narrow-screen floating navigation

The narrow-screen menu uses one navigation node with five ordered items. Four entries are routes. The center entry is the existing `start-brew` action, so it keeps the current route handler and navigation state guards.

Two menu structures were considered. A separate phone-only menu would duplicate route state and event binding. The selected `NAVIGATION_ITEMS` registry models route entries and the start action together, then renders them through the existing menu and click handler.

At widths up to 600 CSS pixels, the menu is a fixed glass pill. Its background, selected item, focus ring, labels, and center action use neutral colors. The existing four-item menu remains visible above that width. The page adds bottom clearance, and the menu uses safe-area insets. Native dialogs remain above the menu in the browser top layer. The menu uses an opaque background when reduced transparency is requested or backdrop blur is unavailable.

## Verification

- `node --test --test-name-pattern='navigation exposes a guarded center action beside its four accessible routes' test/pwa-ui.view.test.mjs` failed before the implementation because the menu had four items instead of five. See [navigation-red.txt](navigation-red.txt).
- `node --test test/pwa-ui.view.test.mjs` passed 178 tests after implementation. The view test confirms that the center item starts `/brew/bean`, and that a pending operation disables it. See [view-tests.txt](view-tests.txt).
- `npm test` passed 726 tests with exit code 0. The first sandbox run could not bind loopback for existing HTTP tests and failed with `listen EPERM`; the rerun with loopback access passed. See [npm-test.txt](npm-test.txt).
- `npm run build:pages` passed and produced build `6997caa17994`. See [build-pages.txt](build-pages.txt).
- `npm run check:pages` passed. See [check-pages.txt](check-pages.txt).
- `git diff --check` passed before commit.

The CUA browser inventory reported that the browser access host was unavailable. No local browser executable or Playwright package was available to the shell, so no responsive screenshot or browser interaction check was run. A physical iPhone was not tested.
