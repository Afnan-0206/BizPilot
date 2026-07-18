/**
 * notificationStore.js
 * Inventory Notification Center — persistence & helpers
 * Storage key: bizpilot_inventory_notifications
 * Max stored: 100 (oldest pruned first)
 */

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'bizpilot_inventory_notifications';
const MAX_NOTIFICATIONS = 100;
const UPDATE_EVENT = 'inventory-notifications-updated';

// ─── Low-level storage helpers ────────────────────────────────
function safeLoad() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeSave(notifications) {
  try {
    // Keep only the most recent MAX_NOTIFICATIONS
    const trimmed = notifications.slice(0, MAX_NOTIFICATIONS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
  } catch (e) {
    console.error('[NotificationStore] Save failed:', e);
  }
}

// ─── Unique ID ─────────────────────────────────────────────────
function genId() {
  return 'notif_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ─── Core API functions (not hooks — safe to call from anywhere) ─
export function addInventoryNotification(notif) {
  const list = safeLoad();
  const full = {
    id: genId(),
    createdAt: new Date().toISOString(),
    read: false,
    ...notif,
  };
  // Prepend — newest first
  const updated = [full, ...list].slice(0, MAX_NOTIFICATIONS);
  safeSave(updated);
  return full;
}

export function getInventoryNotifications() {
  return safeLoad();
}

export function getUnreadNotificationCount() {
  return safeLoad().filter(n => !n.read).length;
}

export function markNotificationAsRead(id) {
  const list = safeLoad().map(n => n.id === id ? { ...n, read: true } : n);
  safeSave(list);
}

export function markAllNotificationsAsRead() {
  const list = safeLoad().map(n => ({ ...n, read: true }));
  safeSave(list);
}

export function clearReadNotifications() {
  // Only remove read ones — never touch unread
  const list = safeLoad().filter(n => !n.read);
  safeSave(list);
}

// ─── Notification factories ────────────────────────────────────

/** Stock changed — auto-creates out_of_stock, low_stock, purchase, or adjustment notif */
export function createStockChangeNotification(product, previousStock, currentStock, reason = 'Manual correction') {
  const diff = currentStock - previousStock;

  // Determine the notification type
  let type, title, message;

  if (currentStock === 0 && previousStock > 0) {
    type = 'out_of_stock';
    title = `${product.name} is out of stock`;
    message = `Stock changed from ${previousStock} unit${previousStock !== 1 ? 's' : ''} to 0 units. Restock this product before confirming new orders.`;
  } else if (
    currentStock > 0 &&
    currentStock <= (product.lowStockThreshold || 0) &&
    previousStock > (product.lowStockThreshold || 0)
  ) {
    type = 'low_stock';
    title = 'Low stock alert';
    message = `${product.name} has only ${currentStock} unit${currentStock !== 1 ? 's' : ''} remaining.`;
  } else if (diff > 0) {
    type = 'purchase';
    title = 'New stock purchased';
    message = `${diff} unit${diff !== 1 ? 's' : ''} of ${product.name} were added to inventory.`;
  } else {
    type = 'adjustment';
    title = 'Stock manually adjusted';
    message = `${product.name} stock was changed from ${previousStock} unit${previousStock !== 1 ? 's' : ''} to ${currentStock} unit${currentStock !== 1 ? 's' : ''}.`;
  }

  return addInventoryNotification({
    type,
    title,
    message,
    productId: product.id,
    productName: product.name,
    quantity: Math.abs(diff),
    previousStock,
    currentStock,
    source: 'manual',
    reason,
  });
}

/** Invoice/order deduction — creates a sale notification */
export function createSaleNotification(product, quantity, documentNumber = '', previousStock = null, currentStock = null) {
  return addInventoryNotification({
    type: 'sale',
    title: 'Product sold',
    message: `${quantity} unit${quantity !== 1 ? 's' : ''} of ${product.name} were deducted${documentNumber ? ` after ${documentNumber} was confirmed` : ''}.`,
    productId: product.id,
    productName: product.name,
    quantity,
    previousStock,
    currentStock,
    source: 'invoice',
    documentNumber,
  });
}

/** AI request with stock shortfall */
export function createInsufficientStockNotification(product, requestedQuantity, availableQuantity) {
  const shortage = requestedQuantity - availableQuantity;
  return addInventoryNotification({
    type: 'insufficient_stock',
    title: 'Insufficient stock request',
    message: `Customer requested ${requestedQuantity} ${product.name}${requestedQuantity !== 1 ? 's' : ''}, but only ${availableQuantity} unit${availableQuantity !== 1 ? 's' : ''} are available.`,
    productId: product.id,
    productName: product.name,
    quantity: requestedQuantity,
    availableQuantity,
    shortage,
    previousStock: availableQuantity,
    currentStock: availableQuantity,
    source: 'ai_request',
  });
}

/** Restock notification (explicit purchase with reason) */
export function createRestockNotification(product, quantity, previousStock, currentStock, reason = 'New stock purchased') {
  return addInventoryNotification({
    type: 'purchase',
    title: 'New stock purchased',
    message: `${quantity} unit${quantity !== 1 ? 's' : ''} of ${product.name} were added to inventory.`,
    productId: product.id,
    productName: product.name,
    quantity,
    previousStock,
    currentStock,
    source: 'inventory',
    reason,
  });
}

// ─── React Hook ────────────────────────────────────────────────
export function useNotificationStore() {
  const [notifications, setNotifications] = useState(safeLoad);

  // Re-read from storage whenever the custom event fires
  useEffect(() => {
    const handler = () => setNotifications(safeLoad());
    window.addEventListener(UPDATE_EVENT, handler);
    return () => window.removeEventListener(UPDATE_EVENT, handler);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markRead = useCallback((id) => {
    markNotificationAsRead(id);
    setNotifications(safeLoad());
  }, []);

  const markAllRead = useCallback(() => {
    markAllNotificationsAsRead();
    setNotifications(safeLoad());
  }, []);

  const clearRead = useCallback(() => {
    clearReadNotifications();
    setNotifications(safeLoad());
  }, []);

  return {
    notifications,
    unreadCount,
    markRead,
    markAllRead,
    clearRead,
    refresh: () => setNotifications(safeLoad()),
  };
}
