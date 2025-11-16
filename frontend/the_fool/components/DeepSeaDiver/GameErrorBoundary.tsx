"use client";

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary for the game
 * Catches any errors and provides a way to restart
 */
export class GameErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 Game Error Caught:', error, errorInfo);
    
    // Log to external service if needed
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleRestart = () => {
    // Clear error state
    this.setState({ hasError: false, error: null });
    
    // Force page reload to restart the game completely
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-blue-900 to-blue-950 text-white p-8">
          <div className="max-w-md text-center space-y-6">
            <div className="text-6xl mb-4">🌊💥</div>
            <h1 className="text-3xl font-bold">Game Error</h1>
            <p className="text-gray-300">
              Something went wrong with the game.
            </p>
            {this.state.error && (
              <details className="text-left bg-black/30 p-4 rounded-lg text-sm">
                <summary className="cursor-pointer font-semibold mb-2">
                  Error Details
                </summary>
                <code className="text-red-400 block whitespace-pre-wrap">
                  {this.state.error.message}
                </code>
              </details>
            )}
            <button
              onClick={this.handleRestart}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
            >
              Restart Game
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
