// Header links to the project's GitHub repo + issues. Icon+text ghost controls matching
// ThemeToggle's style; the octocat is an inline SVG (no icon library, zero external requests).
export const REPO_URL = "https://github.com/qte77/agenthud-agui-a2ui";
const ISSUES_URL = `${REPO_URL}/issues`;

const linkClass =
  "flex items-center gap-1.5 rounded border border-border bg-surface px-2 py-1 text-sm text-text transition-colors hover:border-primary";

// GitHub Invertocat mark — same artwork as the canonical qte77/assets/images/icons/github.svg
// (re-sync from there if it changes). Inlined so it can carry `.gh-mark`, which renders it in
// GitHub's permitted black/white palette — NOT the theme text color — per brand.github.com: the
// mark may invert by theme but must not be recolored.
function GitHubMark() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="currentColor"
      aria-hidden="true"
      className="gh-mark shrink-0"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.65 7.65 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

export function GitHubLinks() {
  return (
    <>
      <a
        href={REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        title="Repository on GitHub"
        className={linkClass}
      >
        <GitHubMark />
        Repo
      </a>
      <a
        href={ISSUES_URL}
        target="_blank"
        rel="noopener noreferrer"
        title="Issues on GitHub"
        className={linkClass}
      >
        <GitHubMark />
        Issues
      </a>
    </>
  );
}
