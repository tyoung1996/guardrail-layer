import { BrowserRouter, Routes, Route } from "react-router-dom";
import Connections from "./pages/Connections";
import Redactions from "./pages/Redactions";
import ChatPage from "./pages/Chat";
import Layout from "./components/Layout";



function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Connections />} />
          <Route path="/redactions/:connectionId" element={<Redactions />} />
          <Route path="/chat" element={<ChatPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;