import { useState, useEffect } from "react";
import {
  getPendingTransactions,
  approveTransaction,
  rejectTransaction,
  getCategories,
  getSubCategories,
} from "../../api/transactions";
import {getSources} from "../../api/paymentSources";
import "./Expenses.css";

export default function ReviewTransactions() {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedId, setExpandedId] = useState(null); // to know which row is in edit mode
    
    //Shared dropdown data for edit panel
    const [categories, setCategories] = useState([]);
    const [sources, setSources] = useState([]);

    //Edit form state 
    const [editForm, setEditForm] = useState({});
    const [subCategories, setSubCategories] = useState([]);

    useEffect(()=> {
        async function load() {
            try {
                const res = await getPendingTransactions();
                setTransactions(res.data.transactions);
                const catRes = await getCategories();
                setCategories(catRes.data.categories);
                const srcRes = await getSources();
                setSources(srcRes.data.sources);
                } catch (err) {
                    setError("Failed to load pending transactions");
                    console.error(err);
                } finally {
                    setLoading(false);
                }
        } load();
    },[]);

    function handleEditClick(txn) {
        if(expandedId === txn.id) {
            //clicking edit again collapses it
            setExpandedId(null);
            return;
        }
        setExpandedId(txn.id);
        setEditForm({
            category_id: txn.category_id || "",
            sub_category_id:  txn.sub_category_id  || "",
            payment_source_id: txn.payment_source_id || "",
            amount:           txn.amount            || "",
            transaction_date: txn.transaction_date  || "",
            description:      txn.description       || "",
        });
        setSubCategories([]);
        if(txn.category_id) {
            getSubCategories(txn.category_id).then((res) => setSubCategories(res.data.subcategories));
        }
    }

    function handleEditChange(e) {
        const {name, value} = e.target;
        if(name === "category_id") {
            setEditForm({...editForm, category_id: value, sub_category_id: ""});
            setSubCategories([]);
            if(value) {
                getSubCategories(value).then((res) =>
            setSubCategories(res.data.subcategories)
        );
        }} else {
            setEditForm({...editForm,[name]: value});
        }
      }

    async function handleApprove(txn) {
        try {
            const isEditing = expandedId === txn.id;
            console.log(isEditing);
            const edits = isEditing ? {
                category_id: editForm.category_id || null,
                sub_category_id:  editForm.sub_category_id  || null,
                payment_source_id: editForm.payment_source_id || null,
                amount:           parseFloat(editForm.amount),
                transaction_date: editForm.transaction_date,
                description:      editForm.description  || null,
          } : {};
          
          await approveTransaction(txn.id,edits);
          setTransactions((prev) => prev.filter((t)=> t.id !== txn.id));
          console.log(transactions);
          setExpandedId(null);
            } catch(err) {
                 console.error("Approve failed", err);
                 alert("Failed to approve. Please try again.");
            }
        }

    async function handleReject(id) {
        if(!window.confirm("Reject this transaction permanently? It will be removed from your records.")) return;
        try {
           await rejectTransaction(id);
           setTransactions((prev) => prev.filter((t)=> t.id !== id));
           if(expandedId === id) setExpandedId(null);
            } catch(err) {
                console.error("Reject failed", err);
                alert("Failed to reject. Please try again.");
            }
    }    
    if (loading) return <div className="expenses-loading">Loading pending transactions...</div>;
    if (error)   return <div className="expense-error">{error}</div>;
    console.log("subCategories state:", subCategories);
    
    return (
        <div className="expense-page">
            <div className="expense-top">
                <h2> Review Transactions</h2>
            </div>
            <p className="expense-subtitle">These were parsed from your forwarded bank emails. Review, edit if needed, then approve or reject.</p>
            {transactions.length === 0 ? ( 
                <p className= "empty-text">No pending transactions</p>
            ) : (
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
                                <>
                            <tr key={t.id}>
                                <td>{t.transaction_date || "-"}</td>
                                <td>{t.type || "-"}</td>
                                <td>{t.category || (<span className="field-error">Unclassified</span>)}</td>
                                <td>{t.sub_catgeory || "-"}</td>
                                <td className="amount-cell">₹{parseFloat(t.amount).toLocaleString("en-IN")}</td>
                                <td>{t.payment_source || "Unknown"}</td>    
                                <td className="desc-cell">{t.description || "-"}</td>
                                <td className="actions-cell">
                                    <button className="btn-edit" onClick={() => handleEditClick(t)}>
                                        {expandedId === t.id? "Cancel":"Edit"}
                                    </button>    
                                    <button className="btn-submit" onClick={() => handleApprove(t)}>
                                        Approve
                                    </button>
                                    <button className="btn-delete" onClick={() => handleReject(t.id)}>
                                        Reject
                                    </button>
                                </td>    
                            </tr>    

                            {expandedId === t.id && (
                                <tr key={`${t.id}-edit`} className="edit-inline-row">
                                    <td colSpan={8}>
                                        <div className="expenses-form-inner">
                                            <p className="expenses-form-title">Edit before approving</p>
                                        <div className="form-row-grid">


                                        <div className="form-data">
                                        <label>Category</label>
                                            <select name="category_id" value={editForm.category_id} onChange={handleEditChange}>
                                            <option value="">Select category</option>
                                            {["Expense", "Income", "Asset", "Liability"].map((type) => {
                                                const group = categories.filter((c) => c.type === type);
                                                if (group.length === 0) return null;
                                                return (
                                                    <optgroup key={type} label={type}>
                                                        {group.map((c) => (
                                                            <option key={c.id} value={c.id}>{c.name}</option>
                                                        ))}
                                                    </optgroup>
                                                );
                                                    })}
                                                </select>
                                        </div>                                                

                                        {subCategories.length > 0 && (
                                        <div className="form-data">
                                        <label>Sub Category</label>
                                        <select name="sub_category_id" value={editForm.sub_category_id} onChange={handleEditChange}>
                                            <option value="">Select Sub Category</option>
                                            {subCategories.map((sc) => (
                                                <option key={sc.id} value={sc.id}>{sc.name}</option>
                                            ))}
                                        </select>
                                        </div>    
                                        )}

                                        <div className="form-data">
                                        <label>Amount (₹)</label>
                                        <input
                                            type="number"
                                            name="amount"
                                            value={editForm.amount}
                                            onChange={handleEditChange}
                                            min="0" />
                                        </div>        

                                        <div className="form-data">
                                        <label>Transaction Date</label>
                                        <input
                                            type="date"
                                            name="transaction_date"
                                            value={editForm.transaction_date}
                                            onChange={handleEditChange}
                                        />
                                        </div>
                                        
                                        <div className="form-data">
                                        <label>Payment Source</label>
                                        <select
                                            name="payment_source_id"
                                            value={editForm.payment_source_id}
                                            onChange={handleEditChange}
                                        >
                                        <option value="">Unknown / Cash</option>
                                        {sources.map((s) => (
                                        <option key={s.id} value={s.id}>{s.nickname}</option>
                                        ))}
                                        </select>
                                        </div>

                                        <div className="form-data form-data-full">
                                        <label>Description</label>
                                        <input
                                            type="text"
                                            name="description"
                                            value={editForm.description}
                                            onChange={handleEditChange}
                                        />
                                        </div>    

                                        </div>
                                        <p style={{ fontSize: "13px", color: "var(--color-text-muted)", marginTop: "8px" }}>
                                        Click Approve in the row above to save these changes and approve.
                                        </p>
                                        </div>                                
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}