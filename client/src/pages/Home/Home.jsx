import { useState } from "react";
import Header from "../Components/Header/Header.jsx";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import api from "../../api/axios.js";
import "./Home.css";

export default function Home() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" });
  }

  async function handleSubmit(type) {
    const newErrors = {};
    if (!formData.email.includes("@")) newErrors.email = "Enter a valid email";
    if (!formData.password) newErrors.password = "Password is required";
    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) return;

    if (type === "login") {
      try {
        const res = await api.post("/auth/login", formData);
        login(res.data.token, res.data.user);
        navigate("/expenses");
      } catch (err) {
        setErrors({ server: err.response?.data?.error || "Login failed" });
      }
    }
  }
  return (
    <div className="home-page">
      <Header />
      <div className="form-card">
        <h2>Welcome</h2>
        <p className="form-subtitle">Sign in or create a new account</p>
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
          {errors.password && <p className="field-error">{errors.password}</p>}
          {errors.server && <p className="field-error">{errors.server}</p>}
        </div>

        <div className="buttons">
          <button className="btn-submit" onClick={() => handleSubmit("login")}>
            Sign In
          </button>
          <button
            className="btn-register"
            onClick={() => navigate("/register")}
          >
            Register
          </button>
        </div>
      </div>
    </div>
  );
}
