// Shared brand mark + tagline used by both the Demo and Live headers.
export function BrandHeader() {
  return (
    <div className="flex items-center gap-2 text-primary">
      <svg
        viewBox="0 0 80 80"
        width="28"
        height="28"
        fill="currentColor"
        aria-hidden="true"
        className="brand-mark"
      >
        <path
          d="M383 561Q383 399 437.0 307.0Q491 215 586 215Q681 215 736.0 307.0Q791 399 791 561Q791 723 736.0 815.0Q681 907 586 907Q491 907 437.0 815.0Q383 723 383 561ZM791 158Q737 64 665.5 17.5Q594 -29 504 -29Q305 -29 197.5 123.0Q90 275 90 559Q90 839 196.0 993.0Q302 1147 494 1147Q595 1147 669.5 1098.0Q744 1049 791 952V1120H1083V-426H791Z"
          transform="translate(14.7126,47.2900) scale(0.013672,-0.013672)"
        />
        <path
          d="M135 1493H1079V1284L573 0H272L758 1233H135Z"
          transform="translate(31.5700,47.2900) scale(0.013672,-0.013672)"
        />
        <rect x="48.43" y="44.29" width="16.86" height="3" rx="1.5" />
      </svg>
      <div className="leading-tight">
        <h1 className="text-lg font-semibold">agenthud</h1>
        <span className="block text-xs font-normal text-text-muted">
          AG-UI events · A2UI rendering
        </span>
      </div>
    </div>
  );
}
