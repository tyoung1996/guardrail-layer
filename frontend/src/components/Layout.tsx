import { Link, Outlet, useLocation } from "react-router-dom";
import DemoBanner from "./DemoBanner";


export default function Layout() {
  const { pathname } = useLocation();

  const navItems = [
    { to: "/", label: "Connections" },
    { to: "/chat", label: "Chat" },
    { to: "/audit", label: "Audit Log" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1b1f] via-[#13141a] to-[#0f1014] text-gray-200 flex flex-col">
      {import.meta.env.VITE_DEMO_MODE === "true" && (
        <>
          <DemoBanner demoModeActive={true} />
          <div className="h-10 sm:h-12"></div>
        </>
      )}
      <header className="sticky top-0 z-40 bg-transparent backdrop-blur-sm shadow-md border-b border-gray-800 w-full">
        <nav className="w-full flex items-center justify-between px-6 sm:px-12 py-4 sm:py-6">
          <h1 className="text-2xl font-extrabold tracking-wide bg-gradient-to-r from-purple-500 via-indigo-400 to-purple-600 bg-clip-text text-transparent select-none drop-shadow-lg hover:scale-[1.02] transition-transform duration-300">
            Guardrail Layer
          </h1>
          <ul className="flex space-x-8">
            {navItems.map(({ to, label }) => (
              <li key={to}>
                <Link
                  to={to}
                  className={`block px-4 py-2 rounded-md transition-all duration-300 relative ${
                    pathname === to
                      ? "text-purple-400 font-semibold"
                      : "text-gray-400 hover:text-purple-400"
                  }`}
                >
                  {label}
                  <span className="absolute left-0 bottom-0 w-full h-0.5 bg-purple-400 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></span>
                </Link>
              </li>
            ))}
          </ul>
          <a
            href="https://github.com/tyoung1996/guardrail-layer"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-6 text-gray-400 hover:text-purple-400 transition-colors"
            aria-label="View on GitHub"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="currentColor"
              viewBox="0 0 24 24"
              className="w-6 h-6"
            >
              <path d="M12 0C5.37 0 0 5.37 0 12a12 12 0 008.21 11.44c.6.11.82-.26.82-.58v-2.23c-3.34.73-4.04-1.61-4.04-1.61-.55-1.41-1.34-1.78-1.34-1.78-1.09-.74.08-.73.08-.73 1.2.08 1.83 1.23 1.83 1.23 1.07 1.83 2.81 1.3 3.5.99.11-.77.42-1.3.76-1.6-2.67-.31-5.47-1.34-5.47-5.96 0-1.32.47-2.39 1.24-3.23-.12-.31-.54-1.55.12-3.23 0 0 1.01-.32 3.3 1.23a11.4 11.4 0 016 0c2.28-1.55 3.3-1.23 3.3-1.23.66 1.68.24 2.92.12 3.23.77.84 1.24 1.91 1.24 3.23 0 4.63-2.81 5.65-5.48 5.96.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.82.58A12 12 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </a>
        </nav>
      </header>

      <main className="flex-1 w-full px-12 py-12">
        <div className="animate-fadeIn transition-all duration-500 ease-in-out">
          <Outlet />
        </div>
      </main>

      <footer className="text-center text-sm text-gray-500 p-8 mt-12 select-none w-full border-t border-gray-800 bg-[#0f1014]/80 backdrop-blur-sm">
        <div className="pt-4">
          © {new Date().getFullYear()} <span className="text-gray-400 hover:text-purple-400 transition-colors">Guardrail Layer</span>
        </div>
      </footer>
    </div>
  );
}