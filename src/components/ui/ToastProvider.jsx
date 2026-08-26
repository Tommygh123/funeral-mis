import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

const inferType = (message) => {
  const value = String(message).toLowerCase();
  if (/error|failed|invalid|denied|missing|expired|cannot|unable|not allowed/.test(value)) return 'error';
  if (/required|please|select|enter|warning/.test(value)) return 'warning';
  return 'success';
};

export const useToast = () => {
  const value = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside ToastProvider');
  return value;
};

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => setToasts((items) => items.filter((item) => item.id !== id)), []);
  const show = useCallback((message, options = {}) => {
    const id = ++nextId.current;
    const type = options.type || inferType(message);
    setToasts((items) => [...items.slice(-3), { id, message: String(message), type }]);
    window.setTimeout(() => dismiss(id), options.duration ?? (type === 'error' ? 6500 : 4500));
    return id;
  }, [dismiss]);

  useEffect(() => {
    const originalAlert = window.alert;
    window.alert = (message) => show(message);
    return () => { window.alert = originalAlert; };
  }, [show]);

  const api = useMemo(() => ({
    show,
    success: (message) => show(message, { type: 'success' }),
    error: (message) => show(message, { type: 'error' }),
    warning: (message) => show(message, { type: 'warning' }),
    info: (message) => show(message, { type: 'info' }),
  }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-viewport" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={`app-toast app-toast-${toast.type}`} role={toast.type === 'error' ? 'alert' : 'status'}>
            <span className="app-toast-icon" aria-hidden="true">{toast.type === 'success' ? '✓' : toast.type === 'info' ? 'i' : '!'}</span>
            <span className="app-toast-message">{toast.message}</span>
            <button type="button" className="app-toast-close" onClick={() => dismiss(toast.id)} aria-label="Dismiss">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export default ToastProvider;
