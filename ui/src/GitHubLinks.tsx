// Header links to the project's GitHub repo + issues. Icon+text ghost controls matching
// ThemeToggle's style. The octocat is GitHub's own black/white mark — vendored from the qte77
// brand kit as ./assets/icons/github-{black,white}.svg and swapped by theme via index.css's
// `.gh-icon` — never recolored, per brand.github.com. The visible labels carry the meaning, so
// the icon is decorative (aria-hidden).
export const REPO_URL = "https://github.com/qte77/agenthud-agui-a2ui";
const ISSUES_URL = `${REPO_URL}/issues`;

const linkClass =
  "flex items-center gap-1.5 rounded border border-border bg-surface px-2 py-1 text-sm text-text transition-colors hover:border-primary";

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
        <span className="gh-icon" aria-hidden="true" />
        Repo
      </a>
      <a
        href={ISSUES_URL}
        target="_blank"
        rel="noopener noreferrer"
        title="Issues on GitHub"
        className={linkClass}
      >
        <span className="gh-icon" aria-hidden="true" />
        Issues
      </a>
    </>
  );
}
