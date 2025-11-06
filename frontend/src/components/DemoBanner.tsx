import React from "react";
import { Link } from "react-router-dom";

interface DemoBannerProps {
  demoModeActive: boolean;
  showLearnMore?: boolean;
}

const DemoBanner: React.FC<DemoBannerProps> = ({ demoModeActive, showLearnMore = false }) => {
  if (!demoModeActive) return null;

  return (
    <div
      className="fixed top-0 left-0 w-full z-50 bg-gradient-to-r from-yellow-900 via-yellow-700 to-yellow-600 border-b border-yellow-500/40 
                 flex items-center justify-center px-4 py-2 text-sm text-yellow-100 font-medium shadow-[0_0_15px_rgba(255,204,0,0.25)] backdrop-blur-sm animate-fadeIn"
      style={{ animationDuration: "400ms", animationTimingFunction: "ease-in-out" }}
      role="banner"
      aria-live="polite"
    >
      <span>🧱 Demo Mode Active — Sample data & limited functionality</span>
      {showLearnMore && (
        <Link
          to="/about"
          className="ml-2 underline text-yellow-300 hover:text-yellow-100 transition-colors"
          aria-label="Learn more about demo mode"
        >
          Learn More
        </Link>
      )}
    </div>
  );
};

export default DemoBanner;
