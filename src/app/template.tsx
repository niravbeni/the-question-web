/**
 * Remounts on every navigation (unlike layout), which is what lets the fade
 * replay each time a new page appears. Opacity-only, so scroll restoration
 * and page layout are untouched.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-page-fade flex min-h-0 flex-1 flex-col">
      {children}
    </div>
  );
}
