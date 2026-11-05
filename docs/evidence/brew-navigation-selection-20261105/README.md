# Brewing navigation selection

The menu previously mapped the brewing section to Home and only updated route controls. It now marks the center brewing action as current throughout `/brew/bean`, `/brew/recipe`, and `/brew/run`, and clears Home. Returning to a catalog or Home restores that route's selection.

The center action is an outlined neutral circle before brewing. During brewing it becomes a dark filled circle with a white icon. The existing narrow menu dimensions and wider menu layout are unchanged.

The regression test failed before the fix because `/brew/bean` selected Home instead of the center control. See [regression-red.txt](regression-red.txt). It passes after the fix, covering every brewing step and exit to the four route menus. The click-path test also checks that pressing the center action selects it and clears Home. The test DOM gained support for class-scoped descendant selectors so it can observe the existing production selection code correctly.

The view suite passed 180 tests before the additional click assertions. After the click assertions were added, `npm test` passed all 728 tests with exit code 0. Pages build and artifact check passed with build `9786b1b45f06`. `git diff --check` passed.

Actual browser layout and physical iPhone interaction remain unverified because the browser host is unavailable.
