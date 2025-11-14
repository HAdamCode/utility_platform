import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { HarmonyLedgerOverviewResponse } from "../types";

export const useHarmonyLedgerOverview = () =>
  useQuery({
    queryKey: ["harmony-ledger", "overview"],
    queryFn: () => api.get<HarmonyLedgerOverviewResponse>("/harmony-ledger/overview"),
    staleTime: 60_000
  });
