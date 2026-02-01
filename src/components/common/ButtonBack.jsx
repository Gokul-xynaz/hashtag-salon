import { useNavigate } from 'react-router-dom';

export default function ButtonBack() {
    const navigate = useNavigate();
    return (
        <button
            onClick={() => navigate(-1)}
            style={{ marginBottom: '1rem', background: 'none', color: 'var(--text-secondary)', padding: 0 }}
        >
            &larr; Back
        </button>
    );
}
