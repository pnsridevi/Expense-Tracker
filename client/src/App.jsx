import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
import { useAuth } from "./context/useAuth.jsx";
import Home from "./pages/Home/Home.jsx";
import Register from "./pages/Components/RegisterForm/Register.jsx";
import Layout from "./pages/Components/Layout/Layout.jsx";
import ViewTransactions from "./pages/Expenses/ViewTransactions.jsx";
import AddTransaction from "./pages/Expenses/AddTransaction.jsx";
import ReviewTransactions from "./pages/Expenses/ReviewTransactions.jsx";
import Settings from "./pages/Settings/Settings.jsx";

function ReDirect() {
  const { token } = useAuth();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Home />} replace />
        <Route path="/register" element={<Register />} />
        <Route element={<ReDirect />}>
          <Route element={<Layout />}>
            <Route path="/expenses">
              <Route index element={<Navigate to="/expenses/view" replace />} />
              <Route path="view" element={<ViewTransactions />} />
              <Route path="add" element={<AddTransaction />} />
              <Route path="review" element={<ReviewTransactions />} />
            </Route>
            <Route path="/settings" element={<Settings />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
