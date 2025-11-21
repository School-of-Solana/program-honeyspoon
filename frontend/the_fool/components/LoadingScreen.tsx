/**
 * LoadingScreen Component
 * 
 * Displays a full-screen loading animation while the game initializes
 */

export function LoadingScreen() {
  return (
    <div className="fixed inset-0 w-screen h-screen flex items-center justify-center bg-gradient-to-b from-blue-900 to-blue-600">
      <div className="nes-container is-rounded with-title bg-gray-900 p-8">
        <p className="title text-yellow-400">Loading Game</p>
        <div className="flex flex-col items-center gap-4">
          <div className="text-6xl animate-bounce">🤿</div>
          <p className="text-white text-center">Connecting to blockchain...</p>
          <div className="flex gap-1">
            <span className="animate-pulse text-white">.</span>
            <span className="animate-pulse delay-100 text-white">.</span>
            <span className="animate-pulse delay-200 text-white">.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
