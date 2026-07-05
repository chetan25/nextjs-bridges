module.exports = {
  extends: ['@commitlint/config-conventional'],
  // semantic-release's `chore(release): ... [skip ci]` commits embed the
  // generated release notes verbatim, which can contain body lines (PR
  // titles, commit links) longer than body-max-line-length. These commits
  // are machine-generated, not authored, so they're exempt from linting.
  ignores: [(message) => message.includes('[skip ci]')],
};
