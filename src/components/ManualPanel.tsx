import type { ReactNode } from 'react';

interface ManualPanelProps {
  id: string;
  open: boolean;
  onClose: () => void;
  title?: string;
  /** マニュアルの本文。内容が決まったらここに渡す */
  children: ReactNode;
}

const ANIMATION = 'max-height 0.3s ease, opacity 0.2s ease, margin-bottom 0.3s ease';

/**
 * 下から展開するマニュアルの説明文エリア。
 * 閉じている間は visibility:hidden にして、キー操作のフォーカス対象から外す。
 */
export default function ManualPanel({ id, open, onClose, title = 'マニュアル', children }: ManualPanelProps) {
  return (
    <div
      id={id}
      role="region"
      aria-label={title}
      style={{
        width: '100%',
        maxHeight: open ? '50vh' : 0,
        marginBottom: open ? 12 : 0,
        opacity: open ? 1 : 0,
        visibility: open ? 'visible' : 'hidden',
        overflow: 'hidden',
        transition: open ? ANIMATION : `${ANIMATION}, visibility 0s linear 0.3s`,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        color: '#fff',
        borderRadius: 8,
        border: '1px solid rgba(255, 255, 255, 0.1)',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <strong style={{ fontSize: 14 }}>{title}</strong>
        <button
          onClick={onClose}
          aria-label="マニュアルを閉じる"
          style={{
            background: 'none',
            border: 'none',
            color: '#fff',
            fontSize: 18,
            lineHeight: 1,
            cursor: 'pointer',
          }}
        >
          ×
        </button>
      </div>
      <div
        style={{
          padding: '12px 16px 16px',
          overflowY: 'auto',
          maxHeight: 'calc(50vh - 48px)',
          fontSize: 13,
          lineHeight: 1.7,
        }}
      >
        {children}
      </div>
    </div>
  );
}
