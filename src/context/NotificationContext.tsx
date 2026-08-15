"use client";

import React, { createContext, useContext, useCallback } from "react";
import { useToast } from "@/components/ui/toast";
import { errorHandler } from "@/lib/errorHandler";

type NotificationType = "success" | "error" | "warning" | "info";

type ErrorSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

interface ErrorInfo {
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
}

interface NotificationContextType {
  addNotification: (message: string, type: NotificationType, severity?: ErrorSeverity) => void;
  addError: (error: AppError) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { showToast } = useToast();

  const addNotification = useCallback(
    (message: string, type: NotificationType = "info", severity?: ErrorSeverity) => {
      showToast(message, type);
    },
    [showToast],
  );

  const addError = useCallback(
    (error: AppError) => {
      // Critical errors are logged, not shown as toast
      if (error.severity === 'CRITICAL') {
        // Send to monitoring endpoint
        errorHandler.sendToMonitoringEndpoint(error).catch(() => {
          // Silently fail
        });
        return;
      }

      // Non-critical errors are shown as toast
      showToast(error.message, 'error');
    },
    [showToast],
  );

  return (
    <NotificationContext.Provider value={{ addNotification, addError }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationContext = () => {
  const context = useContext(NotificationContext);
  if (!context)
    throw new Error(
      "useNotificationContext must be used within NotificationProvider",
    );
  return context;
};