import { BrowserRouter, Routes, Route } from "react-router-dom";
import Connections from "./pages/Connections";
import Redactions from "./pages/Redactions";
import ChatPage from "./pages/Chat";
import AuditLog from "./pages/AuditLog";
import Layout from "./components/Layout";
import ApiKeys from "./pages/ApiKeys";
import Login from "./pages/Login";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import Users from "./pages/Users";
import UserDetailPage from "./pages/UserDetails";
import Roles from "./pages/Roles";
import RoleDetail from "./pages/RoleDetail";

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Connections />} />
        <Route path="/redactions/:connectionId" element={<Redactions />} />
        <Route path="/roles/:id/redactions/:connectionId" element={<Redactions />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/audit" element={<AuditLog />} />
        <Route path="/api-keys" element={<ApiKeys />} />
        <Route path="/users" element={<Users />} />
        <Route path="/users/:id" element={<UserDetailPage />} />
        <Route path="/roles" element={<Roles />} />
        <Route path="/roles/new" element={<RoleDetail />} />
        <Route path="/roles/:id" element={<RoleDetail />} />
      </Route>
    </Routes>
  );
}

export default App;