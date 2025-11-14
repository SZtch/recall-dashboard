// src/utils/toast.js
import toast from "react-hot-toast";

export const showSuccess = (message) => {
  toast.success(message, {
    duration: 3000,
    position: "top-right",
    style: {
      background: "#0f172a",
      color: "#f1f5f9",
      border: "1px solid #10b981",
    },
    iconTheme: {
      primary: "#10b981",
      secondary: "#0f172a",
    },
  });
};

export const showError = (message) => {
  toast.error(message, {
    duration: 4000,
    position: "top-right",
    style: {
      background: "#0f172a",
      color: "#f1f5f9",
      border: "1px solid #ef4444",
    },
    iconTheme: {
      primary: "#ef4444",
      secondary: "#0f172a",
    },
  });
};

export const showLoading = (message) => {
  return toast.loading(message, {
    position: "top-right",
    style: {
      background: "#0f172a",
      color: "#f1f5f9",
      border: "1px solid #3b82f6",
    },
  });
};

export const dismissToast = (toastId) => {
  toast.dismiss(toastId);
};

export const showInfo = (message) => {
  toast(message, {
    duration: 3000,
    position: "top-right",
    icon: "💡",
    style: {
      background: "#0f172a",
      color: "#f1f5f9",
      border: "1px solid #3b82f6",
    },
  });
};
