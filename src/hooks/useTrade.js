// src/hooks/useTrade.js
import { useMutation } from "@tanstack/react-query";
import { executeTrade } from "../api/backend";
import { showSuccess, showError, showLoading, dismissToast } from "../utils/toast";
import { useRefreshData } from "./useRecallAPI";

/**
 * Hook for executing trades
 */
export function useTrade(apiKey, env) {
  const refreshData = useRefreshData();

  return useMutation({
    mutationFn: (tradeParams) => executeTrade(apiKey, env, tradeParams),
    onMutate: () => {
      // Show loading toast
      const toastId = showLoading("Executing trade...");
      return { toastId };
    },
    onSuccess: (data, variables, context) => {
      // Dismiss loading toast
      if (context?.toastId) {
        dismissToast(context.toastId);
      }

      // Show success
      showSuccess(
        `Trade executed! ${variables.amount} ${variables.fromToken} → ${variables.toToken}`
      );

      // Refresh all data
      refreshData();
    },
    onError: (error, variables, context) => {
      // Dismiss loading toast
      if (context?.toastId) {
        dismissToast(context.toastId);
      }

      // Show error
      showError(`Trade failed: ${error.message}`);
    },
  });
}

/**
 * Validate if user has sufficient balance for trade
 */
export function validateTradeBalance(balances, fromToken, amount) {
  const balance = balances?.find(
    (b) => b.token?.toLowerCase() === fromToken?.toLowerCase()
  );

  if (!balance) {
    return {
      valid: false,
      message: `You don't have any ${fromToken} in your balance`,
    };
  }

  const availableAmount = Number(balance.amount || 0);
  const requestedAmount = Number(amount);

  if (requestedAmount > availableAmount) {
    return {
      valid: false,
      message: `Insufficient balance. You have ${availableAmount} ${fromToken}, but trying to trade ${requestedAmount}`,
    };
  }

  return { valid: true };
}
