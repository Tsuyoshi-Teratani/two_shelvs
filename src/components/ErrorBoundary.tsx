import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** エラー時に表示する内容。関数なら発生したエラーを受け取れる */
  fallback: ReactNode | ((error: unknown) => ReactNode);
}

interface State {
  error: unknown;
  failed: boolean;
}

/**
 * 子孫で起きた描画エラー（画像/GLTFの読み込み失敗など）を捕まえる。
 * これが無いと、1つのエラーで画面全体が消えて真っ白になる。
 * R3FのCanvasの内側・外側のどちらにも置ける。
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, failed: false };

  static getDerivedStateFromError(error: unknown): State {
    return { error, failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    const { fallback } = this.props;
    return typeof fallback === 'function' ? fallback(this.state.error) : fallback;
  }
}

/** 画面表示用にエラーからメッセージを取り出す（ローダーはErrorEventなどError以外を投げることがある） */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  const m = (error as { message?: string } | null)?.message;
  return m ?? String(error);
}
