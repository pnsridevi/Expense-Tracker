import "./Header.css";

export default function Header() {
  return (
    <div className="header">
      <div className="logo">
        <div className="logo-box"> ₹</div>
        <span className="logo-name">Expense Tracker</span>
      </div>
      <p className="header-tagline">Track every rupee, effortlessly.</p>
    </div>
  );
}
