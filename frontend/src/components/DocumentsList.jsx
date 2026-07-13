// frontend/src/components/DocumentsList.jsx
import { useState, useEffect } from 'react';
import apiClient from '../api/client';

export default function DocumentsList({ userId, excludeTypes = ['Payslip'] }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDocuments();
  }, [userId]);

  const fetchDocuments = async () => {
    try {
      const res = await apiClient.get(`/users/${userId}/documents`);
      // Filter out excluded types (like Payslip)
      const filtered = (res.data.data || []).filter(
        doc => !excludeTypes.includes(doc.documentType)
      );
      setDocuments(filtered);
    } catch (error) {
      console.error('Fetch documents error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (documentId) => {
    try {
      const res = await apiClient.get(`/users/${userId}/documents/${documentId}/download`);
      const { downloadUrl } = res.data.data;
      window.open(downloadUrl, '_blank');
    } catch (error) {
      console.error('Download error:', error);
      alert('Failed to download document');
    }
  };

  const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

  const getTypeBadge = (type) => {
    const colors = {
      PKWT: 'bg-blue-100 text-blue-800',
      PKWTT: 'bg-green-100 text-green-800',
      Internship: 'bg-purple-100 text-purple-800',
      Amendment: 'bg-yellow-100 text-yellow-800',
      LoA: 'bg-indigo-100 text-indigo-800',
      KTP: 'bg-orange-100 text-orange-800',
      NPWP: 'bg-teal-100 text-teal-800',
      BPJS_Kesehatan: 'bg-cyan-100 text-cyan-800',
      BPJS_TK: 'bg-sky-100 text-sky-800',
      SIM: 'bg-amber-100 text-amber-800',
      KK: 'bg-lime-100 text-lime-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return <div className="text-center py-4 text-gray-500">Loading...</div>;
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <svg className="w-12 h-12 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        No documents available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <div key={doc.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <svg className="w-10 h-10 text-gray-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <h3 className="font-medium text-gray-900">{doc.fileName}</h3>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                  <span className={`px-2 py-0.5 rounded-full font-medium ${getTypeBadge(doc.documentType)}`}>
                    {doc.documentType}
                  </span>
                  {doc.startDate && doc.endDate && (
                    <span>{formatDate(doc.startDate)} - {formatDate(doc.endDate)}</span>
                  )}
                </div>
                {doc.notes && (
                  <p className="mt-2 text-sm text-gray-600">{doc.notes}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => handleDownload(doc.id)}
              className="ml-4 text-blue-600 hover:text-blue-800 flex-shrink-0"
              title="Download document"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}