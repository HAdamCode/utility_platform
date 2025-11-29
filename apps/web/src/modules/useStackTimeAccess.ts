import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import type { StackTimeAccessResponse } from "../types";

export const useStackTimeAccess = () =>
  useQuery({
    queryKey: ["stack-time", "access"],
    queryFn: () => api.get<StackTimeAccessResponse>("/stack-time/access"),
    staleTime: 60_000
  });
