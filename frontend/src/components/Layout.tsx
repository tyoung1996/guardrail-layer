import { Link, Outlet, useLocation } from "react-router-dom";

export default function Layout() {
  const { pathname } = useLocation();

  const navItems = [
    { to: "/", label: "Connections" },
    { to: "/chat", label: "Chat" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-900 text-gray-200 flex flex-col">
      <header className="sticky top-0 z-50 bg-gradient-to-r from-indigo-800 via-purple-700 to-indigo-800 shadow-[0_0_15px_3px_rgba(139,92,246,0.8)] backdrop-blur-md bg-opacity-40 w-full">
        <nav className="w-full flex items-center justify-between p-6">
          <h1 className="text-2xl font-extrabold tracking-wide bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent select-none drop-shadow-lg">
            Guardrail Layer
          </h1>
          <ul className="flex space-x-8">
            {navItems.map(({ to, label }) => (
              <li key={to}>
                <Link
                  to={to}
                  className={`block px-4 py-2 rounded-md transition-all duration-300 ${
                    pathname === to
                      ? "bg-gradient-to-r from-purple-600 via-pink-600 to-red-600 shadow-[0_0_8px_2px_rgba(219,39,119,0.7)] text-transparent bg-clip-text font-semibold"
                      : "text-gray-400 hover:text-transparent hover:bg-gradient-to-r hover:from-purple-400 hover:via-pink-500 hover:to-red-500 hover:bg-clip-text hover:drop-shadow-lg"
                  }`}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="flex-1 w-full p-8 backdrop-blur-sm bg-transparent rounded-lg shadow-inner mt-6">
        <Outlet />
      </main>

      <footer className="text-center text-sm text-gray-500 p-6 mt-12 select-none w-full">
        © {new Date().getFullYear()} Guardrail Layer
      </footer>
    </div>
  );
}