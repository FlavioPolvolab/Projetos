import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
  errorInfo: any;
}

class ErrorBoundary extends React.Component<{children: React.ReactNode}, ErrorBoundaryState> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    this.setState({ error, errorInfo });
    // Você pode logar o erro em um serviço externo aqui
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, background: '#fff0f0', color: '#900', borderRadius: 8 }}>
          <h2>Ocorreu um erro inesperado em um componente React.</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>
            {this.state.error && this.state.error.toString()}
            {'\n'}
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: 16, padding: 8, background: '#900', color: '#fff', border: 'none', borderRadius: 4 }}>Recarregar página</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary; 