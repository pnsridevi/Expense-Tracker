import { useState, useEffect } from "react";
import {
  getSources,
  addSource,
  deleteSource,
} from "../../api/paymentSources.js";
import "./Settings.css";

const emptyForm = {
  source_type: "credit_card",
  provider: "",
  last4: "",
  upi_id: "",
  nickname: "",
};

export default function Settings() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [sources, setSources] = useState([]);
  const [errors, setErrors] = useState({});

  const needsLast4 = ["credit_card", "debit_card", "netbanking"].includes(
    form.source_type,
  );
  const needsUpi = form.source_type === "upi";

  useEffect(() => {
    async function fetchSources() {
      try {
        const res = await getSources();
        setSources(res.data.sources);
      } catch (err) {
        console.error("Failed to fetch payment sources", err);
      }
    }
    fetchSources();
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    setErrors({ ...errors, [name]: "" });
  }

  async function handleSubmit() {
    const newErrors = {};
    if (!form.provider) newErrors.provider = "Bank / provider name is required";
    if (!form.nickname) newErrors.nickname = "Nickname is required";
    if (needsLast4 && !/^\d{4}$/.test(form.last4))
      newErrors.last4 = "Enter valid 4 digits";
    if (needsUpi && !form.upi_id) newErrors.upi_id = "UPI ID is required";

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    try {
      await addSource({
        source_type: form.source_type,
        provider: form.provider,
        last4: needsLast4 ? form.last4 : null,
        upi_id: needsUpi ? form.upi_id : null,
        nickname: form.nickname,
      });
      setForm(emptyForm);
      setShowForm(false);
      const res = await getSources();
      setSources(res.data.sources);
    } catch (err) {
      setErrors({
        server: err.response?.data?.error || "Failed to add source",
      });
    }
  }

  async function handleDelete(id) {
    try {
      await deleteSource(id);
      setSources(sources.filter((s) => s.id !== id));
    } catch (err) {
      console.error("Delete failed", err);
    }
  }

  return (
    <div className="settings-page">
      {/* ── Header ── */}
      <div className="settings-top">
        <h2>Payment Sources</h2>
        <button className="btn-toggle" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ Add Source"}
        </button>
      </div>
      <p className="settings-subtitle">
        Manage your cards, UPI IDs and bank accounts
      </p>

      {/* ── Add Form ── */}
      {showForm && (
        <div className="settings-form">
          <div className="settings-form-bar" />
          <div className="settings-form-inner">
            <p className="settings-form-title">Add New Source</p>

            <div className="form-row-grid">
              <div className="form-data">
                <label>Type</label>
                <select
                  name="source_type"
                  value={form.source_type}
                  onChange={handleChange}
                >
                  <option value="credit_card">Credit Card</option>
                  <option value="debit_card">Debit Card</option>
                  <option value="upi">UPI</option>
                  <option value="netbanking">Net Banking</option>
                </select>
              </div>

              <div className="form-data">
                <label>Bank / Provider</label>
                <input
                  type="text"
                  name="provider"
                  placeholder="e.g. HDFC, GPay"
                  value={form.provider}
                  onChange={handleChange}
                />
                {errors.provider && (
                  <p className="field-error">{errors.provider}</p>
                )}
              </div>

              {needsLast4 && (
                <div className="form-data">
                  <label>Last 4 Digits</label>
                  <input
                    type="text"
                    name="last4"
                    maxLength={4}
                    placeholder="e.g. 4242"
                    value={form.last4}
                    onChange={handleChange}
                  />
                  {errors.last4 && (
                    <p className="field-error">{errors.last4}</p>
                  )}
                </div>
              )}

              {needsUpi && (
                <div className="form-data">
                  <label>UPI ID</label>
                  <input
                    type="text"
                    name="upi_id"
                    placeholder="e.g. name@okaxis"
                    value={form.upi_id}
                    onChange={handleChange}
                  />
                  {errors.upi_id && (
                    <p className="field-error">{errors.upi_id}</p>
                  )}
                </div>
              )}

              <div className="form-data">
                <label>Nickname</label>
                <input
                  type="text"
                  name="nickname"
                  placeholder="e.g. HDFC Credit / GPay"
                  value={form.nickname}
                  onChange={handleChange}
                />
                {errors.nickname && (
                  <p className="field-error">{errors.nickname}</p>
                )}
              </div>
            </div>

            {errors.server && <p className="field-error">{errors.server}</p>}

            <button className="btn-submit" onClick={handleSubmit}>
              Save Source
            </button>
          </div>
        </div>
      )}

      {/* ── Source Cards ── */}
      {sources.length === 0 ? (
        <p className="empty-text">No payment sources added yet.</p>
      ) : (
        <>
          <p className="section-label">Your sources</p>
          <div className="sources-grid">
            {sources.map((src) => (
              <div
                key={src.id}
                className="source-card"
                data-type={src.source_type}
              >
                {/* gradient top bar via CSS ::before using data-type */}
                <div
                  style={{
                    height: "4px",
                    background:
                      src.source_type === "credit_card"
                        ? "linear-gradient(90deg, #007779, #00809d)"
                        : src.source_type === "upi"
                          ? "linear-gradient(90deg, #0086bd, #4d88d3)"
                          : src.source_type === "debit_card"
                            ? "linear-gradient(90deg, #4d88d3, #9486d8)"
                            : "linear-gradient(90deg, #007779, #9486d8)",
                  }}
                />
                <div style={{ padding: "1rem 1.25rem" }}>
                  <div className="source-card-top">
                    <span className="source-nickname">{src.nickname}</span>
                    <span className="source-type">
                      {src.source_type.replace("_", " ")}
                    </span>
                  </div>
                  <p className="source-bank">{src.provider}</p>
                  {src.last4 && (
                    <p className="source-detail">•••• {src.last4}</p>
                  )}
                  {src.upi_id && <p className="source-detail">{src.upi_id}</p>}
                  <button
                    className="btn-delete"
                    onClick={() => handleDelete(src.id)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
