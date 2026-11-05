# Publication verification

The neutral floating navigation was integrated into `main` at `4bbd7dbf94dab29830e7b2ca50f98bb90a880d26` and published with build `048b4c8f511c`.

- Public app: https://kangseokgyu.github.io/bean-pocket/
- Workflow: https://github.com/kangseokgyu/bean-pocket/actions/runs/41945200526
- The manual `pages.yml` run used `main` and `probes=false`. Both build and deploy jobs completed successfully. See [deployment.json](deployment.json).
- The public `index.html` reports build `048b4c8f511c`. All 27 public files returned HTTP 200 and matched the validated local `dist/` bytes. See [public-files.json](public-files.json).
- Post-integration `npm test` passed 727 tests with exit code 0. `npm run build:pages` and `npm run check:pages` both exited 0 and produced the same build version.
- The independent Critic accepted both corrections and ran 10 relevant tests successfully. No additional defects were found in the second review.

The browser host was unavailable. Responsive screenshots, actual browser layout, Safari touch behavior, and a physical iPhone were not verified. The public file comparison confirms deployment, not visual correctness.

Worker used `gpt-6-luna` with `max` reasoning. Critic used `gpt-6.1-sol` with `medium` reasoning. These settings were explicitly passed to the agent creation tool.
