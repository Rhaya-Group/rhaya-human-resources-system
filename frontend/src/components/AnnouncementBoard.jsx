// frontend/src/components/AnnouncementBoard.jsx
import { useState, useEffect } from 'react';
import apiClient from '../api/client';

const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export default function AnnouncementBoard({ className = '' }) {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const res = await apiClient.get('/announcements');
      setAnnouncements(res.data.data || []);
    } catch (error) {
      console.error('Fetch announcements error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || announcements.length === 0) return null;

  const visible = expanded ? announcements : announcements.slice(0, 1);
  const hasMore = announcements.length > 1;

  return (
    <div className={`space-y-3 ${className}`}>
      {visible.map((a) => (
        <div
          key={a.id}
          className={`rounded-lg p-4 border ${
            a.isPinned ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-100'
          }`}
        >
          <div className="flex items-start gap-3">
            <svg
              className={`w-5 h-5 flex-shrink-0 mt-0.5 ${a.isPinned ? 'text-amber-600' : 'text-blue-600'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
              />
            </svg>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                {a.isPinned && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded bg-amber-200 text-amber-800">
                    Pinned
                  </span>
                )}
                <h3 className="font-semibold text-gray-900 text-sm">{a.title}</h3>
              </div>
              <p className="text-sm text-gray-700 mt-1 whitespace-pre-line">{a.body}</p>
              <p className="text-xs text-gray-500 mt-2">
                {a.createdBy?.name} · {formatDate(a.createdAt)}
              </p>
            </div>
          </div>
        </div>
      ))}

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium pl-1"
        >
          {expanded ? '▾ Show less' : `▸ Show ${announcements.length - 1} more announcement${announcements.length - 1 > 1 ? 's' : ''}`}
        </button>
      )}
    </div>
  );
}
