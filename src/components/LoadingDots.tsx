/**
 * Three dots that ripple in turn to signal an in-flight wait: the loading
 * screens between routes and the publish button both use it. The dots take
 * their colour from the current text colour, so a caller sets the tone by
 * wrapping this in a text-colour class (dark on paper, paper on ink). The hop
 * and fade come from the `dot-bounce` keyframe in globals.css.
 */
export default function LoadingDots({ size = "md" }: { size?: "sm" | "md" }) {
  const dot = size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2";
  const gap = size === "sm" ? "gap-1" : "gap-1.5";
  return (
    <span className={`inline-flex items-center ${gap}`} aria-hidden>
      {[0, 160, 320].map((delay) => (
        <span
          key={delay}
          className={`${dot} animate-dot-bounce rounded-full bg-current`}
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}
