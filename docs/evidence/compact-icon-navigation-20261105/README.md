# Compact icon navigation

At widths up to 600 CSS pixels, navigation labels are hidden. Each button retains its existing accessible name and title. Wider layouts retain their visible labels and existing menu styling.

The mobile bar uses 44px button heights, 6px padding on each side, and a 1px border, for a 58px default height. Its width is capped at 280px and remains within safe-area margins. The icons are 22px square. The bar remains centered and 12px above the bottom safe area. Content bottom clearance is reduced by the same 16px as the bar height.

This is a CSS display change. No route, event handler, or state logic was changed. The existing view suite passed 179 tests, and `npm test` passed all 727 tests with exit code 0. `npm run build:pages` and `npm run check:pages` passed with build `fc407938ceec`. `git diff --check` passed.

Actual browser layout and physical iPhone interaction remain unverified because the browser host is unavailable. CSS dimensions describe the default layout and do not establish measured device dimensions.
