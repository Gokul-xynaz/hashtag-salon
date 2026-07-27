import { AlertCircle, AlertTriangle, Trophy, Info, Zap } from 'lucide-react';

export const SEVERITY_CONFIG = {
  critical:    { color: '#dc2626', bg: '#fee2e2', Icon: AlertCircle },
  warning:     { color: '#d97706', bg: '#fef3c7', Icon: AlertTriangle },
  opportunity: { color: '#2563eb', bg: '#dbeafe', Icon: Zap },
  celebration: { color: '#16a34a', bg: '#dcfce7', Icon: Trophy },
  info:        { color: '#64748b', bg: '#f1f5f9', Icon: Info },
};
