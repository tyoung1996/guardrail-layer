import { Link, Outlet, useLocation } from "react-router-dom";
import { useState } from "react";
import { Menu, X, Link as LinkIcon, MessageSquare, FileText, Key, Users, LogOut, Github, UserCog } from "lucide-react";
import DemoBanner from "./DemoBanner";
import { useAuth } from "../auth/AuthProvider";


export default function Layout() {
  const { pathname } = useLocation();
  const { logout } = useAuth();
  const { user } = useAuth();
  const isAdmin = user?.isAdmin || false;
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = isAdmin
    ? [
        { to: "/", label: "Connections", icon: LinkIcon },
        { to: "/chat", label: "Chat", icon: MessageSquare },
        { to: "/audit", label: "Audit Log", icon: FileText },
        { to: "/users", label: "Users", icon: Users },
        { to: "/roles", label: "Roles", icon: UserCog },
      ]
    : [
        { to: "/chat", label: "Chat", icon: MessageSquare },
      ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1b1f] via-[#13141a] to-[#0f1014] text-gray-200 flex">
      {import.meta.env.VITE_DEMO_MODE === "true" && (
        <>
          <DemoBanner demoModeActive={true} />
          <div className="h-10 sm:h-12"></div>
        </>
      )}
      
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0f1014]/95 backdrop-blur-xl border-r border-gray-800 transform transition-transform duration-300 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between p-6 border-b border-gray-800">
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-500 via-indigo-400 to-purple-600 bg-clip-text text-transparent">
              Guardrail Layer
            </h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-gray-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {navItems.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                  pathname === to
                    ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                    : "text-gray-400 hover:bg-gray-800/50 hover:text-purple-400"
                }`}
              >
                <Icon size={20} />
                <span className="font-medium">{label}</span>
              </Link>
            ))}
          </nav>

          {/* Bottom Actions */}
          <div className="p-4 space-y-2 border-t border-gray-800">
            <a
              href="https://github.com/tyoung1996/guardrail-layer"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-gray-800/50 hover:text-purple-400 transition-all duration-200"
            >
              <Github size={20} />
              <span className="font-medium">GitHub</span>
            </a>
            <button
              onClick={logout}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
            >
              <LogOut size={20} />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:ml-64">
        {/* Header */}
        <header className="sticky top-0 z-30 bg-[#0f1014]/80 backdrop-blur-sm border-b border-gray-800">
          <div className="flex items-center justify-between px-6 py-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-400 hover:text-white transition-colors"
            >
              <Menu size={24} />
            </button>
            <div className="lg:hidden">
              <h1 className="text-lg font-bold bg-gradient-to-r from-purple-500 via-indigo-400 to-purple-600 bg-clip-text text-transparent">
                Guardrail Layer
              </h1>
            </div>
            <div className="hidden lg:block" />
          </div>
        </header>

        {/* Main */}
        <main className="flex-1 p-6 lg:p-12">
          <div className="animate-fadeIn transition-all duration-500 ease-in-out">
            <Outlet />
          </div>
        </main>

        {/* Footer */}
        <footer className="text-center text-sm text-gray-500 p-6 border-t border-gray-800 bg-[#0f1014]/80 backdrop-blur-sm">
          © {new Date().getFullYear()} <span className="text-gray-400 hover:text-purple-400 transition-colors">Guardrail Layer</span>
        </footer>
      </div>
    </div>
  );
}