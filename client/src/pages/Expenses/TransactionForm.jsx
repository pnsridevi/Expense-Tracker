import { useState, useEffect } from "react";
import {
  getCategories,
  getSubCategories,
  addTransaction,
  updateTransaction,
} from "../../api/transactions.js";
import { getSources } from "../../api/paymentSources.js";

function getEmptyForm() {
  return {
    transaction_type: "",
    category_id: "",
    sub_category_id: "",
    payment_source_id: "",
    amount: "",
    transaction_date: new Date().toISOString().split("T")[0],
    description: "",
  };
}

/* mode: edit || add
   editData - transaction object passed from ViewTransactions when mode is edit
   onSuccess - callback after successful save
   onClose - calllback to close modal */

export default function TransactionForm({
  mode = "add",
  editData = null,
  onSuccess,
  onCancel,
}) {
  const [form, setForm] = useState(getEmptyForm);
  const [categories, setCategories] = useState([]);
  const [subCategories, setSubCategories] = useState([]);
  const [sources, setSources] = useState([]);
  const [errors, setErrors] = useState({});
  const [successMsg, setSuccessMsg] = useState("");

  //Fetch categories and sources on load

  useEffect(() => {
    async function fetchData() {
      try {
        const resultCategory = await getCategories();
        const resultSource = await getSources();
        setCategories(resultCategory.data.categories);
        setSources(resultSource.data.sources);
      } catch (err) {
        console.error("Failed to fetch form data", err);
      }
    }
    fetchData();
  }, []);

  async function fetchSubCategories(categoryId) {
    try {
      const res = await getSubCategories(categoryId);
      setSubCategories(res.data.subcategories);
    } catch (err) {
      console.error("Failed to fetch subcategories", err);
    }
  }

  //Pre-fill form when editing

  useEffect(() => {
    if (mode !== "edit" || !editData) return;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    setForm({
      transaction_type: editData.type || "",
      category_id: editData.category_id || "",
      sub_category_id: editData.sub_category_id || "",
      payment_source_id: editData.payment_source_id || "",
      amount: editData.amount || "",
      transaction_date: editData.transaction_date
        ? editData.transaction_date.split("T")[0]
        : new Date().toISOString().split("T")[0],
      description: editData.description || "",
    });

    // Fetch subcategories for the pre-filled category
    if (!editData.category_id) return;
    let cancelled = false;
    async function loadSubCategories() {
      try {
        const res = await getSubCategories(editData.category_id);
        if (!cancelled) setSubCategories(res.data.subcategories);
      } catch (err) {
        console.error("Failed to load subcategroies", err);
      }
    }
    loadSubCategories();
    return () => {
      cancelled = true;
    };
  }, [mode, editData]);

  // Show only categories matching the selected transaction type
  const filteredCategories = form.transaction_type
    ? categories.filter((c) => c.type === form.transaction_type)
    : [];

  function handleChange(e) {
    const { name, value } = e.target;
    if (name === "transaction_type") {
      setForm({
        ...form,
        transaction_type: value,
        category_id: "",
        sub_category_id: "",
      });
      setSubCategories([]);
    } else if (name === "category_id") {
      setForm({ ...form, category_id: value, sub_category_id: "" });
      if (value) fetchSubCategories(value);
      else setSubCategories([]);
    } else {
      setForm({ ...form, [name]: value });
    }
    setErrors({ ...errors, [name]: "" });
  }

  async function handleSubmit() {
    const newErrors = {};
    if (!form.transaction_type)
      newErrors.transaction_type = "Transaction type is required";
    if (!form.category_id) newErrors.category_id = "Category is required";
    if (!form.amount || isNaN(form.amount) || parseFloat(form.amount) <= 0)
      newErrors.amount = "Enter a valid amount";
    if (!form.transaction_date) newErrors.transaction_date = "Date is required";

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    const payload = {
      category_id: form.category_id,
      transaction_type: form.transaction_type,
      sub_category_id: form.sub_category_id || null,
      payment_source_id: form.payment_source_id || null,
      amount: parseFloat(form.amount),
      transaction_date: form.transaction_date,
      description: form.description || null,
    };

    try {
      if (mode === "add") {
        await addTransaction({ ...payload, entry_mode: "manual" });
        setForm(getEmptyForm());
        setSubCategories([]);
        setSuccessMsg("Transaction added successfully!");
        setTimeout(() => setSuccessMsg(""), 3000);
      } else {
        await updateTransaction(editData.id, payload);
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      setErrors({
        server: err.response?.data?.error || "Failed to save transaction",
      });
    }
  }

  return (
    <div className="expenses-form">
      <div className="expenses-form-bar" />
      <div className="expenses-form-inner">
        <p className="expenses-form-title">
          {mode === "add" ? "Transaction Details" : "Edit Transaction"}
        </p>

        {successMsg && <p className="success-msg">{successMsg}</p>}

        <div className="form-row-grid">
          {/* Transaction Type */}
          <div className="form-data">
            <label>Transaction Type</label>
            <select
              name="transaction_type"
              value={form.transaction_type}
              onChange={handleChange}
            >
              <option value="">Select type</option>
              <option value="Expense">Expense</option>
              <option value="Income">Income</option>
              <option value="Asset">Asset</option>
              <option value="Liability">Liability</option>
            </select>
            {errors.transaction_type && (
              <p className="field-error">{errors.transaction_type}</p>
            )}
          </div>

          {/* Category */}
          <div className="form-data">
            <label>Category</label>
            <select
              name="category_id"
              value={form.category_id}
              onChange={handleChange}
              disabled={!form.transaction_type}
            >
              <option value="">Select category</option>
              {filteredCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.category_id && (
              <p className="field-error">{errors.category_id}</p>
            )}
          </div>

          {/* Sub Category */}
          {subCategories.length > 0 && (
            <div className="form-data">
              <label>Sub Category</label>
              <select
                name="sub_category_id"
                value={form.sub_category_id}
                onChange={handleChange}
              >
                <option value="">Select sub category</option>
                {subCategories.map((sc) => (
                  <option key={sc.id} value={sc.id}>
                    {sc.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Amount */}
          <div className="form-data">
            <label>Amount (₹)</label>
            <input
              type="number"
              name="amount"
              placeholder="e.g. 500"
              value={form.amount}
              onChange={handleChange}
              min="0"
            />
            {errors.amount && <p className="field-error">{errors.amount}</p>}
          </div>

          {/* Date */}
          <div className="form-data">
            <label>Transaction Date</label>
            <input
              type="date"
              name="transaction_date"
              value={form.transaction_date}
              onChange={handleChange}
            />
            {errors.transaction_date && (
              <p className="field-error">{errors.transaction_date}</p>
            )}
          </div>

          {/* Payment Source */}
          <div className="form-data">
            <label>Payment Source</label>
            <select
              name="payment_source_id"
              value={form.payment_source_id}
              onChange={handleChange}
            >
              <option value="">Cash</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nickname}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="form-data form-data-full">
            <label>Description</label>
            <input
              type="text"
              name="description"
              placeholder="e.g. Swiggy order, SIP investment"
              value={form.description}
              onChange={handleChange}
            />
          </div>
        </div>

        {errors.server && <p className="field-error">{errors.server}</p>}

        <div className="form-actions">
          <button className="btn-submit" onClick={handleSubmit}>
            {mode === "add" ? "Save Transaction" : "Update Transaction"}
          </button>
          {mode === "edit" && onCancel && (
            <button className="btn-cancel" onClick={onCancel}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
