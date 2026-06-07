import React, { useState, useRef, useEffect } from 'react';

const CustomDropdown = ({ value, onChange, options, placeholder = "Select...", disabled = false, style = {} }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedOption = options.find(opt => opt.value === value);

    const handleSelect = (val) => {
        onChange(val);
        setIsOpen(false);
    };

    return (
        <div ref={dropdownRef} style={{ position: 'relative', width: '100%', ...style }}>
            <div
                onClick={() => !disabled && setIsOpen(!isOpen)}
                style={{
                    width: '100%',
                    padding: '0.5rem 0.65rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    background: disabled ? '#f3f4f6' : 'white',
                    color: selectedOption ? '#1f2937' : '#9ca3af',
                    fontSize: '0.85rem',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxSizing: 'border-box',
                    transition: 'all 0.2s ease',
                    boxShadow: isOpen ? '0 0 0 2px rgba(59, 130, 246, 0.2)' : 'none',
                    borderColor: isOpen ? '#3b82f6' : '#d1d5db'
                }}
            >
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <svg
                    style={{
                        width: '16px', height: '16px', color: '#6b7280',
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease'
                    }}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
            </div>

            {isOpen && !disabled && (
                <div
                    style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '4px',
                        background: 'white',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                        zIndex: 1000,
                        maxHeight: '200px',
                        overflowY: 'auto',
                        animation: 'dropdownFadeIn 0.15s ease-out'
                    }}
                >
                    <style>
                        {`
                            @keyframes dropdownFadeIn {
                                from { opacity: 0; transform: translateY(-5px); }
                                to { opacity: 1; transform: translateY(0); }
                            }
                        `}
                    </style>
                    {options.length === 0 ? (
                        <div style={{ padding: '0.5rem 0.75rem', fontSize: '0.85rem', color: '#9ca3af' }}>
                            No options available
                        </div>
                    ) : (
                        options.map((opt, i) => (
                            <div
                                key={opt.value + i.toString()}
                                onClick={() => handleSelect(opt.value)}
                                style={{
                                    padding: '0.5rem 0.75rem',
                                    fontSize: '0.85rem',
                                    cursor: 'pointer',
                                    color: '#1f2937',
                                    background: value === opt.value ? '#eff6ff' : 'white',
                                    borderLeft: value === opt.value ? '2px solid #3b82f6' : '2px solid transparent',
                                    transition: 'background 0.15s ease'
                                }}
                                onMouseEnter={(e) => {
                                    if (value !== opt.value) e.currentTarget.style.background = '#f9fafb';
                                }}
                                onMouseLeave={(e) => {
                                    if (value !== opt.value) e.currentTarget.style.background = 'white';
                                }}
                            >
                                {opt.label}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default CustomDropdown;
