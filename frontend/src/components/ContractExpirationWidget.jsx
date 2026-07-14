// frontend/src/components/ContractExpirationWidget.jsx
// HR widget: employees with contracts expiring soon or already expired.
// Backs up the automated H-30/H-14/H-7/expired email reminders with an at-a-glance view.

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';

const BUCKET_CONFIG = [
  { key: 'expired', label: 'Expired', color: 'bg-red-50 border-red-200 text-red-700', badge: 'bg-red-100 text-red-800' },
  { key: 'h7', label: 'Expiring ≤ 7 days', color: 'bg-orange-50 border-orange-200 text-orange-700', badge: 'bg-orange-100 text-orange-800' },
  { key: 'h14', label: 'Expiring ≤ 14 days', color: 'bg-amber-50 border-amber-200 text-amber-700', badge: 'bg-amber-100 text-amber-800' },
  { key: 'h30', label: 'Expiring ≤ 30 days', color: 'bg-blue-50 border-blue-200 text-blue-700', badge: 'bg-blue-100 text-blue-800' },
];

const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

export default function ContractExpirationWidget() {
  const navigate = useNavigate();
  const [buckets, setBuckets] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedBucket, setExpandedBucket] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/users/contract-expirations');
      setBuckets(res.data.data);
    } catch (error) {
      console.error('Fetch contract expirations error:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalCount = buckets
    ? BUCKET_CONFIG.reduce((sum, b) => sum + buckets[b.key].length, 0)
    : 0;

  if (loading) {
    return (
      <div className="mb-6 bg-white rounded-lg shadow p-4 animate-pulse">
        <div className="h-5 bg-gray-200 rounded w-1/4 mb-3"></div>
        <div className="h-16 bg-gray-100 rounded"></div>
      </div>
    );
  }

  if (!buckets || totalCount === 0) return null;

  return (
    <div className="mb-6 bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center">
          <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Contract Expirations
        </h3>
        <span className="text-xs text-gray-500">{totalCount} employee{totalCount === 1 ? '' : 's'}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {BUCKET_CONFIG.map((bucket) => {
          const items = buckets[bucket.key];
          if (items.length === 0) return null;
          const isExpanded = expandedBucket === bucket.key;
          return (
            <button
              key={bucket.key}
              onClick={() => setExpandedBucket(isExpanded ? null : bucket.key)}
              className={`text-left border rounded-lg p-3 ${bucket.color} hover:opacity-80`}
            >
              <p className="text-xs font-medium uppercase tracking-wide">{bucket.label}</p>
              <p className="text-2xl font-bold mt-1">{items.length}</p>
            </button>
          );
        })}
      </div>

      {expandedBucket && buckets[expandedBucket].length > 0 && (
        <div className="mt-4 border-t pt-3">
          <div className="space-y-2">
            {buckets[expandedBucket].map((emp) => {
              const bucketMeta = BUCKET_CONFIG.find((b) => b.key === expandedBucket);
              return (
                <div
                  key={emp.id}
                  onClick={() => navigate(`/users/${emp.id}`)}
                  className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{emp.name}</p>
                    <p className="text-xs text-gray-500">
                      {emp.nip || 'No NIP'} · {emp.division || 'No division'}
                      {emp.entity ? ` · ${emp.entity.code}` : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${bucketMeta.badge}`}>
                      {emp.daysUntilExpiry < 0
                        ? `${Math.abs(emp.daysUntilExpiry)}d ago`
                        : emp.daysUntilExpiry === 0
                          ? 'Today'
                          : `in ${emp.daysUntilExpiry}d`}
                    </span>
                    <p className="text-xs text-gray-500 mt-0.5">{formatDate(emp.contractEndDate)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
