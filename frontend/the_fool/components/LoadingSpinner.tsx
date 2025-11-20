/**
 * Loading Spinner Component
 * 
 * Retro NES-style loading indicator for blockchain operations
 */
export function LoadingSpinner({ size = "md", message }: { size?: "sm" | "md" | "lg"; message?: string }) {
  const sizeClasses = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div className="nes-container is-rounded is-dark inline-block">
        <p className={sizeClasses[size]}>
          <span className="animate-pulse">...</span>
          {message || "Loading"}
          <span className="animate-pulse">...</span>
        </p>
      </div>
    </div>
  );
}

/**
 * Inline Loading Spinner
 * For smaller UI elements
 */
export function InlineSpinner() {
  return (
    <span className="inline-block animate-pulse text-yellow-400">
      ⏳
    </span>
  );
}
