import TransactionForm from "./TransactionForm.jsx";
import "./Expenses.css";

export default function AddTransaction() {
  return (
    <div className="expense-page">
      <div className="expense-top">
        <h2>Add Transaction</h2>
      </div>
      <p className="expense-subtitle">
        Record a new income, expense or investment manually
      </p>
      <TransactionForm mode="add" />
    </div>
  );
}
