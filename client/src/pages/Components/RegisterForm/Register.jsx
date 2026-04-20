import { useState } from "react";
import Header from "../Header/Header.jsx";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/useAuth.jsx";
import api from "../../../api/axios.js";
import "./Register.css";

export default function Register() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    reenterpwd: "",
  });
  const [errors, setErrors] = useState({});

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" });
  }

  async function handleSubmit() {
    const newErrors = {};
    if (!formData.name) newErrors.name = "Enter your name";
    if (!formData.email.includes("@")) newErrors.email = "Enter a valid email";
    if (!formData.password) newErrors.password = "Password is required";
    //    if (!formData.reenterpwd) newErrors.reeneterpwd = "Reconfirm your password";
    if (
      formData.password &&
      formData.reenterpwd &&
      formData.password !== formData.reenterpwd
    )
      newErrors.reenterpwd = "Passwords do not match";
    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) return;

    try {
      const dataToSend = {
        name: formData.name,
        email: formData.email,
        password: formData.password,
      };
      const res = await api.post("/auth/register", dataToSend);
      login(res.data.token, res.data.user);
      navigate("/expenses");
    } catch (err) {
      setErrors({ server: err.response?.data?.error || "Registration failed" });
    }
  }

  return (
    <div className="register-page">
      <Header />
      <div className="form-card">
        <h2>Register to Expense Tracker and track your expenses now!</h2>
        <div className="form-data">
          <label>Name</label>
          <input type="name" name="name" onChange={handleChange}></input>
        </div>
        {errors.name && <p className="field-error">{errors.name}</p>}
        <div className="form-data">
          <label>Email</label>
          <input type="email" name="email" onChange={handleChange}></input>
          {errors.email && <p className="field-error">{errors.email}</p>}
        </div>
        <div className="form-data">
          <label>Password</label>
          <input
            type="password"
            name="password"
            onChange={handleChange}
          ></input>
        </div>
        {errors.password && <p className="field-error">{errors.password}</p>}
        <div className="form-data">
          <label>Reenter Password</label>
          <input
            type="password"
            name="reenterpwd"
            onChange={handleChange}
          ></input>
          {errors.reenterpwd && (
            <p className="field-error">{errors.reenterpwd}</p>
          )}
        </div>
        {errors.server && <p className="server-error">{errors.server}</p>}
        <div className="buttons">
          <button className="btn-submit" onClick={handleSubmit}>
            Register
          </button>
          <button className="btn-goback" onClick={() => navigate("/login")}>
            Go back
          </button>
        </div>
      </div>
    </div>
  );
}
