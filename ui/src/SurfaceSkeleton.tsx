// Pending-render skeleton (Plan 008 · PR3): shown via A2UIRenderer's `fallback` while the Live
// surface is empty and a run is streaming — from Run-click until the first render_ui batch lands.
// Purely presentational; styling in index.css (.qte-skeleton*), brand tokens only.

const BAR_WIDTHS = ["40%", "90%", "75%", "60%"];

export function SurfaceSkeleton() {
  return (
    <div className="qte-skeleton" role="status" aria-label="Generating interface…">
      {BAR_WIDTHS.map((width) => (
        <div key={width} className="qte-skeleton-bar" style={{ width }} />
      ))}
    </div>
  );
}
