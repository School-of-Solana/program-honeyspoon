"use client";

import { Toaster } from "react-hot-toast";

/**
 * Toast Notification Provider
 *
 * Provides global toast notifications with NES-style theme
 */
export function ToastProvider() {
  return (
    <Toaster
      position="top-center"
      toastOptions={{
        // Default options
        duration: 4000,
        style: {
          background: "#212529",
          color: "#fff",
          border: "4px solid #fff",
          padding: "16px",
          fontFamily: "var(--font-nes), monospace",
          fontSize: "12px",
          boxShadow: "0 4px 0 0 #000",
        },
        // Success toasts
        success: {
          duration: 3000,
          iconTheme: {
            primary: "#92cc41",
            secondary: "#fff",
          },
          style: {
            background: "#92cc41",
            color: "#000",
            border: "4px solid #000",
          },
        },
        // Error toasts
        error: {
          duration: 5000,
          iconTheme: {
            primary: "#e76e55",
            secondary: "#fff",
          },
          style: {
            background: "#e76e55",
            color: "#fff",
            border: "4px solid #000",
          },
        },
        // Loading toasts
        loading: {
          iconTheme: {
            primary: "#f7d51d",
            secondary: "#000",
          },
          style: {
            background: "#f7d51d",
            color: "#000",
            border: "4px solid #000",
          },
        },
      }}
    />
  );
}
