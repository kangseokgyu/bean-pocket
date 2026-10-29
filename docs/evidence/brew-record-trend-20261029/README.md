# Brew record trend evidence

This folder records the feature requirements and verification artifacts for the recent-bean list and rating-trend chart.

- `spec.md`: behavior and verification summary.
- `recent-trend.red.txt`, `focused-green.txt`: focused test RED/GREEN evidence.
- `npm-test.txt`: final full test run, 620 passing.
- `npm-test-sandbox-listen-eperm.txt`: initial sandbox run; loopback listeners were blocked, so the test suite was rerun with the project-required elevated permission.
- `build-pages-final.txt`, `check-pages.txt`: final Pages build (`c9fb149587d6`) and output validation.
- `build-preview.txt`: initial build rejection for an inline SVG namespace URL; static SVG templates resolved it without changing the output checker.
- `browser-validation.cjs`, `browser-validation.txt`: Chromium checks of sorting, keyboard selection, graph labels/spacing, filter isolation, viewport widths, console and requests.
- `screen-320.png`, `screen-550.png`, `screen-768.png`, `screen-1024.png`, `screen-1440.png`: viewport screenshots.
