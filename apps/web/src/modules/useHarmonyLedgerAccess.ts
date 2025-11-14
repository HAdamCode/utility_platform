import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { HarmonyLedgerAccessResponse } from "../types";

export const useHarmonyLedgerAccess = () =>
  useQuery({
    queryKey: ["harmony-ledger", "access"],
    queryFn: () => api.get<HarmonyLedgerAccessResponse>("/harmony-ledger/access"),
    staleTime: 60_000
  });
