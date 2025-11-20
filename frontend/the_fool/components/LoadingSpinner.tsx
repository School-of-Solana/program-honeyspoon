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

/**
 * Button Loading State
 * Shows loading spinner inside a button
 */
export function ButtonSpinner({ message = "Processing..." }: { message?: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className="animate-spin">⏳</span>
      {message}
    </span>
  );
}

/**
 * Overlay Loading Screen
 * Full-screen loading overlay for critical operations
 */
export function LoadingOverlay({ message = "Processing transaction..." }: { message?: string }) {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="nes-container is-rounded with-title bg-gray-900 p-8">
        <p className="title text-yellow-400">Please Wait</p>
        <div className="flex flex-col items-center gap-4">
          <div className="text-4xl animate-bounce">🤿</div>
          <p className="text-white text-center">{message}</p>
          <div className="flex gap-1">
            <span className="animate-pulse delay-0">.</span>
            <span className="animate-pulse delay-100">.</span>
            <span className="animate-pulse delay-200">.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
