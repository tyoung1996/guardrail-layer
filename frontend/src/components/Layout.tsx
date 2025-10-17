import { Link, Outlet, useLocation } from "react-router-dom";

export default function Layout() {
  const { pathname } = useLocation();

  const navItems = [
    { to: "/", label: "Connections" },
    { to: "/chat", label: "Chat" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1b1f] via-[#13141a] to-[#0f1014] text-gray-200 flex flex-col">
      <header className="sticky top-0 z-50 bg-transparent backdrop-blur-md border-b border-gray-800 w-full">
        <nav className="w-full flex items-center justify-between px-12 py-6">
          <h1 className="text-2xl font-extrabold tracking-wide bg-gradient-to-r from-purple-500 via-indigo-400 to-purple-600 bg-clip-text text-transparent select-none drop-shadow-lg">
            Guardrail Layer
          </h1>
          <ul className="flex space-x-8">
            {navItems.map(({ to, label }) => (
              <li key={to}>
                <Link
                  to={to}
                  className={`block px-4 py-2 rounded-md transition-all duration-300 ${
                    pathname === to
                      ? "text-purple-400 font-semibold"
                      : "text-gray-400 hover:text-purple-400"
                  }`}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="flex-1 w-full px-12 py-12">
        <Outlet />
      </main>

      <footer className="text-center text-sm text-gray-500 p-6 mt-12 select-none w-full">
        © {new Date().getFullYear()} Guardrail Layer
      </footer>
    </div>
  );
}