import React, { useState, useRef, useEffect } from 'react';

const SearchableDropdown = ({ value, onChange, options, placeholder = "Select or type...", disabled = false, style = {} }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value || '');
    const dropdownRef = useRef(null);
    const inputRef = useRef(null);

    // Sync external value changes (e.g. from parent state)
    useEffect(() => {
        if (value !== undefined) {
            setInputValue(value);
        }
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
                // On blur, commit the current input value only if it changed
                if (inputValue !== value) {
                    onChange(inputValue);
                }
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [inputValue, onChange, value]);

    const filteredOptions = options.filter(opt => 
        opt.label.toLowerCase().includes(inputValue.toLowerCase())
    );

    const handleSelect = (val) => {
        setInputValue(val);
        onChange(val);
        setIsOpen(false);
    };

    const handleInputChange = (e) => {
        const val = e.target.value;
        setInputValue(val);
        setIsOpen(true);
        onChange(val); // emit changes as typing so parent state reflects custom input immediately
    };

    return (
        <div ref={dropdownRef} style={{ position: 'relative', width: '100%', ...style }}>
            <div style={{ position: 'relative' }}>
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onFocus={() => !disabled && setIsOpen(true)}
                    placeholder={placeholder}
                    disabled={disabled}
                    style={{
                        width: '100%',
                        padding: '0.5rem 2rem 0.5rem 0.65rem', // Extra right padding for chevron
                        border: '1px solid #d1d5db',
                        borderRadius: '6px',
                        background: disabled ? '#f3f4f6' : 'white',
                        color: '#1f2937',
                        fontSize: '0.85rem',
                        boxSizing: 'border-box',
                        transition: 'all 0.2s ease',
                        boxShadow: isOpen ? '0 0 0 2px rgba(59, 130, 246, 0.2)' : 'none',
                        borderColor: isOpen ? '#3b82f6' : '#d1d5db',
                        outline: 'none'
                    }}
                />
                <div 
                    onClick={() => {
                        if (!disabled) {
                            if (!isOpen) inputRef.current?.focus();
                            setIsOpen(!isOpen);
                        }
                    }}
                    style={{
                        position: 'absolute',
                        right: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        cursor: disabled ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#6b7280'
                    }}
                >
                    <svg
                        style={{
                            width: '16px', height: '16px',
                            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease'
                        }}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>

            {isOpen && !disabled && filteredOptions.length > 0 && (
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
                    {filteredOptions.map((opt, i) => (
                        <div
                            key={opt.value + i.toString()}
                            onClick={() => handleSelect(opt.value)}
                            style={{
                                padding: '0.5rem 0.75rem',
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                color: '#1f2937',
                                background: inputValue === opt.value ? '#eff6ff' : 'white',
                                borderLeft: inputValue === opt.value ? '2px solid #3b82f6' : '2px solid transparent',
                                transition: 'background 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                                if (inputValue !== opt.value) e.currentTarget.style.background = '#f9fafb';
                            }}
                            onMouseLeave={(e) => {
                                if (inputValue !== opt.value) e.currentTarget.style.background = 'white';
                            }}
                        >
                            {opt.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SearchableDropdown;
