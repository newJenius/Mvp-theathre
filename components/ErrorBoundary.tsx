import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          background: '#111114',
          color: '#e0e0e0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          textAlign: 'center'
        }}>
          <div>
            <h1 style={{ color: '#ff5252', marginBottom: '20px' }}>Что-то пошло не так</h1>
            <p style={{ marginBottom: '20px', color: '#bdbdbd' }}>
              Произошла ошибка при загрузке страницы.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#18181b',
                color: '#e0e0e0',
                border: '1px solid #23232a',
                borderRadius: '6px',
                padding: '12px 24px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              Обновить страницу
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 