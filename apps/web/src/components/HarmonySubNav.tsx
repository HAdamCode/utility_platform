import { NavLink } from "react-router-dom";

const HarmonySubNav = () => (
  <div className="sub-nav">
    <NavLink
      to="/harmony-ledger/overview"
      className={({ isActive }) => (isActive ? "sub-link active" : "sub-link")}
    >
      Overview
    </NavLink>
    <NavLink
      to="/harmony-ledger/ledger"
      className={({ isActive }) => (isActive ? "sub-link active" : "sub-link")}
    >
      Ledger
    </NavLink>
  </div>
);

export default HarmonySubNav;
