"use client";

import React, { createContext, useContext, useCallback, useEffect } from "react";
import { useToast } from "@/components/ui/toast";
import type { AppError, ErrorCategory } from "@/lib/errorHandler";
import { blockchainEvents, type BlockchainEvent } from "@/lib/blockchainEvents";
import { useWalletStore } from "@/store";

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
  const address = useWalletStore((state) => state.session?.address);

  useEffect(() => {
    if (address) blockchainEvents.start(address);
    else blockchainEvents.stop();
    return () => blockchainEvents.stop();
  }, [address]);

  useEffect(() => blockchainEvents.subscribe((event: BlockchainEvent) => {
    const messages: Partial<Record<BlockchainEvent['type'], string>> = {
      'policy.purchased': 'Your policy purchase was confirmed on-chain.',
      'policy.updated': 'One of your policies was updated on-chain.',
      'claim.submitted': 'Your claim submission was confirmed on-chain.',
      'claim.updated': 'The status of one of your claims changed.',
      'proposal.updated': 'A governance proposal status changed.',
      'vote.cast': 'New voting results are available.',
    };
    const message = messages[event.type];
    if (message) showToast(message, event.type.endsWith('purchased') || event.type.endsWith('submitted') ? 'success' : 'info');
  }), [showToast]);

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
        console.error('[Critical application error]', error);
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
