import React, { useState } from 'react';

export default function PasswordInput({ style, wrapperStyle, ...props }) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: 'relative', width: '100%', ...wrapperStyle }}>
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        style={{ ...style, paddingRight: 62 }}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        title={visible ? 'Hide password' : 'Show password'}
        style={{
          position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
          border: 0, background: 'transparent', color: '#2563eb', cursor: 'pointer',
          fontSize: 12, fontWeight: 700, padding: '4px 2px', lineHeight: 1,
        }}
      >
        {visible ? 'Hide' : 'Show'}
      </button>
    </div>
  );
}
