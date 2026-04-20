import { useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../../context/useAuth";
import "../Sidebar/Sidebar.css";

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const initials = user?.name?.slice(0, 2).toUpperCase();

  const [expensesOpen, setExpensesOpen] = useState(
    location.pathname.startsWith("/expenses"),
  );

  const isExpensesActive = location.pathname.startsWith("/expenses");

  return (
    <div className="sidebar">
      <div className="side-heading">
        <h3>Expense tracking</h3>
      </div>
      <nav className="sidebar-nav">
        <div
          className={isExpensesActive ? "nav-item-active" : "nav-item"}
          onClick={() => setExpensesOpen(!expensesOpen)}
        >
          <span className="nav-dot" />
          <span> Expenses</span>
          <span className="nav-arrow">{expensesOpen ? "▾" : "▸"}</span>
        </div>

        {expensesOpen && (
          <div className="nav-sub">
            <NavLink
              to="/expenses/view"
              className={({ isActive }) =>
                isActive ? "nav-item-active" : "nav-item"
              }
            >
              <span className="nav-dot" />
              <span>View Transactions</span>
            </NavLink>
            <NavLink
              to="/expenses/add"
              className={({ isActive }) =>
                isActive ? "nav-item-active" : "nav-item"
              }
            >
              <span className="nav-dot" />
              <span>Add Transaction</span>
            </NavLink>
            <NavLink
              to="/expenses/review"
              className={({ isActive }) =>
                isActive ? "nav-item-active" : "nav-item"
              }
            >
              <span className="nav-dot" />
              <span>Review Transactions</span>
            </NavLink>
          </div>
        )}
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            isActive ? "nav-item-active" : "nav-item"
          }
        >
          <span className="nav-dot" />
          <span>Settings</span>
        </NavLink>
      </nav>
      <div className="sidebar-footer">
        <div className="avatar">{initials}</div>
        <div className="user-info">
          <div className="user-name">{user?.name}</div>
          <div className="user-email">{user?.email}</div>
        </div>
        <button
          className="btn-logout"
          onClick={() => {
            logout();
            navigate("/login");
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}
