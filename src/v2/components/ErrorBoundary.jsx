import React from 'react';
import { logError } from '../utils/logger';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render shows the fallback UI.
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // Log the error to our professional Firestore logger
        logError('React ErrorBoundary', error, {
            componentStack: errorInfo.componentStack
        });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '3rem', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
                    <div style={{ maxWidth: '500px', margin: '0 auto', background: '#fee2e2', border: '1px solid #f87171', borderRadius: '8px', padding: '2rem' }}>
                        <h1 style={{ color: '#991b1b', marginTop: 0 }}>Something went wrong.</h1>
                        <p style={{ color: '#7f1d1d' }}>We encountered an unexpected error. Our technical team has been automatically notified.</p>
                        <button 
                            onClick={() => window.location.reload()}
                            style={{ marginTop: '1rem', padding: '0.75rem 1.5rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            Reload Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children; 
    }
}

export default ErrorBoundary;
