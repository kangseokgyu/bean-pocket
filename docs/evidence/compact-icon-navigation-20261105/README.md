# Compact icon navigation

At widths up to 600 CSS pixels, navigation labels are hidden. Each button retains its existing accessible name and title. Wider layouts retain their visible labels and existing menu styling.

The mobile bar uses 44px button heights, 6px padding on each side, and a 1px border, for a 58px default height. Its width is capped at 280px and remains within safe-area margins. The icons are 22px square. The bar remains centered and 12px above the bottom safe area. Content bottom clearance is reduced by the same 16px as the bar height.

This is a CSS display change. No route, event handler, or state logic was changed. The existing view suite passed 179 tests, and `npm test` passed all 727 tests with exit code 0. `npm run build:pages` and `npm run check:pages` passed with build `fc407938ceec`. `git diff --check` passed.

Actual browser layout and physical iPhone interaction remain unverified because the browser host is unavailable. CSS dimensions describe the default layout and do not establish measured device dimensions.

## Publication

After integration into `main` at `05baec4`, the required checks passed again: 727 tests, Pages build, and Pages artifact check. The manual general-release workflow used `probes=false` and [completed successfully](https://github.com/kangseokgyu/bean-pocket/actions/runs/41950461646). See [deployment.json](deployment.json).

The [public app](https://kangseokgyu.github.io/bean-pocket/) reports build `fc407938ceec`. All 27 public static files returned HTTP 200 and matched the validated local build byte for byte. See [public-files.json](public-files.json). This confirms publication, not visual correctness.
