import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";

export default function Logo({ to = "/" }) {
  return (
    <Link to={to} className="logo">
      <span className="logo-mark">
        <Sparkles size={16} strokeWidth={2.2} />
      </span>
      <span className="logo-text">
        IntentDesk<span classname="logo-accent">AI</span>
      </span>
    </Link>
  );
}
