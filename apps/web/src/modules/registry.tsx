import type { ReactNode } from "react";
import { ExpensesGlyphIcon } from "../components/icons/UtilityIcons";

export interface ModuleDefinition {
  id: string;
  name: string;
  description: string;
  path: string;
  tags: string[];
  maturity: "alpha" | "beta" | "stable";
  icon?: ReactNode;
}

export const modules: ModuleDefinition[] = [
  {
    id: "group-expenses",
    name: "Group Expenses",
    description:
      "Track shared trip expenses, digitize receipts, and keep running balances for everyone in your traveling party.",
    path: "/group-expenses",
    tags: ["travel", "finance", "receipts"],
    maturity: "beta",
    icon: <ExpensesGlyphIcon />
  }
];
