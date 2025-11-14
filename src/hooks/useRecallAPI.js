// src/hooks/useRecallAPI.js
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getBalances, getHistory, getPnlUnrealized } from "../api/backend";

/**
 * Hook for fetching balances
 */
export function useBalances(apiKey, env, options = {}) {
  return useQuery({
    queryKey: ["balances", apiKey, env],
    queryFn: () => getBalances(apiKey, env),
    enabled: !!(apiKey && env),
    staleTime: 15000, // 15 seconds
    refetchOnWindowFocus: true,
    ...options,
  });
}

/**
 * Hook for fetching trade history
 */
export function useHistory(apiKey, env, options = {}) {
  return useQuery({
    queryKey: ["history", apiKey, env],
    queryFn: () => getHistory(apiKey, env),
    enabled: !!(apiKey && env),
    staleTime: 15000,
    refetchOnWindowFocus: true,
    ...options,
  });
}

/**
 * Hook for fetching PnL data
 */
export function usePnL(apiKey, env, options = {}) {
  return useQuery({
    queryKey: ["pnl", apiKey, env],
    queryFn: () => getPnlUnrealized(apiKey, env),
    enabled: !!(apiKey && env),
    staleTime: 15000,
    refetchOnWindowFocus: true,
    ...options,
  });
}

/**
 * Hook for refreshing all data
 */
export function useRefreshData() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: ["balances"] });
    queryClient.invalidateQueries({ queryKey: ["history"] });
    queryClient.invalidateQueries({ queryKey: ["pnl"] });
  };
}
