import React from 'react';
import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      textAlign: 'center',
      backgroundColor: '#f8fafc',
      fontFamily: 'Inter, system-ui, sans-serif',
      padding: '20px'
    }}>
      <h1 style={{ 
        fontSize: '8rem', 
        margin: 0, 
        color: '#0f172a',
        fontWeight: '800',
        lineHeight: '1'
      }}>404</h1>
      <h2 style={{ 
        fontSize: '2rem', 
        margin: '10px 0 20px 0', 
        color: '#334155',
        fontWeight: '600'
      }}>Page Not Found</h2>
      <p style={{ 
        color: '#64748b', 
        marginBottom: '40px',
        maxWidth: '500px',
        fontSize: '1.1rem',
        lineHeight: '1.6'
      }}>
        The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
      </p>
      <Link 
        to="/" 
        style={{
          padding: '14px 28px',
          backgroundColor: '#0f172a',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '8px',
          fontWeight: '600',
          fontSize: '1rem',
          transition: 'all 0.2s ease',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
        }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1e293b'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#0f172a'}
      >
        Go Back Home
      </Link>
    </div>
  );
};

export default NotFound;
