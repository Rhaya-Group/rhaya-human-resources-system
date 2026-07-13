// frontend/src/components/DocumentsList.jsx
import { useState, useEffect } from 'react';
import apiClient from '../api/client';
import DocumentPreviewModal from './DocumentPreviewModal';
import { getTypeBadge, getExpiryInfo, formatDate, isPreviewable } from '../utils/documentTypes';

export default function DocumentsList({ userId, excludeTypes = ['Payslip'] }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewDoc, setPreviewDoc] = useState(null);

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

  const handlePreview = async (doc) => {
    try {
      const res = await apiClient.get(`/users/${userId}/documents/${doc.id}/download`);
      setPreviewDoc({ ...doc, previewUrl: res.data.data.downloadUrl });
    } catch (error) {
      console.error('Preview error:', error);
      alert('Failed to load preview');
    }
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
      {documents.map((doc) => {
        const expiry = getExpiryInfo(doc.endDate);
        return (
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
                    {expiry && (
                      <span className={`px-2 py-0.5 rounded-full font-medium ${expiry.className}`}>{expiry.label}</span>
                    )}
                  </div>
                  {doc.notes && (
                    <p className="mt-2 text-sm text-gray-600">{doc.notes}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 ml-4 flex-shrink-0">
                {isPreviewable(doc.mimeType) && (
                  <button onClick={() => handlePreview(doc)} className="text-gray-500 hover:text-gray-800" title="Preview">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                )}
                <button
                  onClick={() => handleDownload(doc.id)}
                  className="text-blue-600 hover:text-blue-800"
                  title="Download document"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {previewDoc && (
        <DocumentPreviewModal
          fileName={previewDoc.fileName}
          mimeType={previewDoc.mimeType}
          previewUrl={previewDoc.previewUrl}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
}
