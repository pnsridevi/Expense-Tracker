import { useState, useEffect } from "react";
import { getTransactions, deleteTransaction } from "../../api/transactions";
import TransactionForm from "./TransactionForm.jsx";
import "./Expenses.css";

export default function ViewTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editData, setEditData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    async function fetchTransactions() {
      try {
        const res = await getTransactions();
        setTransactions(res.data.transactions);
      } catch (err) {
        setError("Failed to fetch transactions");
        console.log(err);
      }
      setLoading(false);
    }
    fetchTransactions();
  }, []);

  async function handleDelete(id) {
    if (!window.confirm("Are you sure you want to delete this transaction?"))
      return;
    try {
      await deleteTransaction(id);
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error("Delete failed", err);
    }
  }

  function handleEditClick(transaction) {
    setEditData(transaction);
  }
  async function fetchTransactions(isInitial = false) {
    if (isInitial) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await getTransactions();
      setTransactions(res.data.transactions);
      setError(null);
    } catch (err) {
      setError("Failed to fetch transactions", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchTransactions(true); // initial load
  }, []);
  async function handleEditSuccess() {
    setEditData(null);
    await fetchTransactions();
  }
  function handleEditCancel() {
    setEditData(null);
  }

  if (loading)
    return <div className="expenses-loading">Loading transactions...</div>;
  {
    refreshing && <p className="refresh-hint">Refreshing...</p>;
  }
  {
    error && (
      <div className="expense-error">
        {error} <button onClick={() => fetchTransactions(false)}>Retry</button>
      </div>
    );
  }

  return (
    <div className="expense-page">
      <div className="expense-top">
        <h2>Transactions</h2>
      </div>
      <p className="expense-subtitle">View and manage all your transactions</p>

      {/* Edit Mode */}
      {editData && (
        <div className="modal-overlay">
          <div className="modal-box">
            <TransactionForm
              mode="edit"
              editData={editData}
              onSuccess={handleEditSuccess}
              onCancel={handleEditCancel}
            />
          </div>
        </div>
      )}

      {/* Table */}
      {transactions.length === 0 ? (
        <p className="empty-text">No transactions found. Add one!</p>
      ) : (
        <>
          <p className="section-label">Your transactions</p>
          <div className="table-wrapper">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Sub Category</th>
                  <th>Amount</th>
                  <th>Source</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td> {t.transaction_date.split("T")[0]}</td>
                    <td> {t.type}</td>
                    <td>{t.category}</td>
                    <td>{t.sub_category || "-"}</td>
                    <td className="amount-cell">
                      ₹{parseFloat(t.amount).toLocaleString("en-IN")}
                    </td>
                    <td>{t.payment_source || "cash"}</td>
                    <td className="desc-cell">{t.description || "-"}</td>
                    <td className="actions-cell">
                      <button
                        className="btn-edit"
                        onClick={() => handleEditClick(t)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn-delete"
                        onClick={() => handleDelete(t.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
