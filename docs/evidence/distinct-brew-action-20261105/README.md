# Distinct brewing action

The narrow-screen brewing action uses a dark neutral 44px circle with a white cup icon. Route selection retains its pale translucent background and dark icon. The action also retains white icon contrast on hover. The bar stays 58px high and at most 280px wide. Wide-screen navigation is unchanged.

Only CSS presentation changes. Existing accessible names, navigation selection, disabled state, and brewing behavior are unchanged. `npm test` passed 727 tests with exit code 0. Pages build and artifact check passed with build `918f14fc7382`, and `git diff --check` passed.

Actual browser appearance and physical iPhone interaction remain unverified because a working browser host is unavailable. Dimensions are CSS defaults, not device measurements.

## Publication

After integration at `a0007d2`, `npm test` passed all 727 tests again. Pages build and artifact check also passed. The manual general-release workflow ran on `main` with `probes=false` and [completed successfully](https://github.com/kangseokgyu/bean-pocket/actions/runs/41953710491). See [deployment.json](deployment.json).

The [public app](https://kangseokgyu.github.io/bean-pocket/) reports build `918f14fc7382`. All 27 static files returned HTTP 200 and matched the verified local build bytes. See [public-files.json](public-files.json). This verifies publication, not visual correctness.
