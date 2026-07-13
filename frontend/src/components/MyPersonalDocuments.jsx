// frontend/src/components/MyPersonalDocuments.jsx
// Self-service upload for personal-ID documents (KTP/NPWP/BPJS/SIM/KK).
// Employees can upload + view/download their own; edit/delete stays HR-only
// (these are legal/ID records — corrections go through FilesTab in UserDetail).

import { useState, useEffect } from 'react';
import apiClient from '../api/client';
import DocumentPreviewModal from './DocumentPreviewModal';
import {
  PERSONAL_DOC_TYPES,
  ALLOWED_FILE_TYPES,
  getTypeBadge,
  getExpiryInfo,
  formatDate,
  formatFileSize,
  isPreviewable,
} from '../utils/documentTypes';

export default function MyPersonalDocuments({ userId }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);

  const [uploadData, setUploadData] = useState({
    file: null,
    documentType: 'KTP',
    documentNumber: '',
    endDate: '',
    notes: '',
  });

  useEffect(() => {
    fetchDocuments();
  }, [userId]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/users/${userId}/documents`);
      const personalTypeValues = PERSONAL_DOC_TYPES.map((t) => t.value);
      setDocuments((res.data.data || []).filter((d) => personalTypeValues.includes(d.documentType)));
    } catch (error) {
      console.error('Fetch documents error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file && ALLOWED_FILE_TYPES.includes(file.type)) {
      if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        return;
      }
      setUploadData({ ...uploadData, file });
    } else {
      alert('Only PDF, JPG, or PNG files are allowed');
      e.target.value = '';
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadData.file) {
      alert('Please select a file');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', uploadData.file);
      formData.append('documentType', uploadData.documentType);
      if (uploadData.documentNumber) formData.append('documentNumber', uploadData.documentNumber);
      if (uploadData.endDate) formData.append('endDate', uploadData.endDate);
      if (uploadData.notes) formData.append('notes', uploadData.notes);

      await apiClient.post(`/users/${userId}/documents/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      alert('Document uploaded successfully!');
      setShowUploadModal(false);
      setUploadData({ file: null, documentType: 'KTP', documentNumber: '', endDate: '', notes: '' });
      fetchDocuments();
    } catch (error) {
      console.error('Upload error:', error);
      alert(error.response?.data?.error || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (documentId) => {
    try {
      const res = await apiClient.get(`/users/${userId}/documents/${documentId}/download`);
      window.open(res.data.data.downloadUrl, '_blank');
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

  return (
    <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-50 flex justify-between items-center">
        <div className="flex items-center space-x-2 text-gray-400">
          <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-xs font-black uppercase tracking-widest">My Personal Documents</h3>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center whitespace-nowrap text-sm"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Upload
        </button>
      </div>

      <div className="p-6">
      <p className="text-xs text-gray-500 mb-4">KTP, NPWP, BPJS Kesehatan, BPJS Ketenagakerjaan, SIM, KK</p>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : documents.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <svg className="w-12 h-12 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          No personal documents uploaded yet
        </div>
      ) : (
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
                        {doc.documentNumber && <span>No. {doc.documentNumber}</span>}
                        <span>{formatFileSize(doc.fileSize)}</span>
                        {expiry && (
                          <span className={`px-2 py-0.5 rounded-full font-medium ${expiry.className}`}>{expiry.label}</span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-gray-400">Uploaded {formatDate(doc.uploadedAt)}</p>
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
                    <button onClick={() => handleDownload(doc.id)} className="text-blue-600 hover:text-blue-800" title="Download">
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {previewDoc && (
        <DocumentPreviewModal
          fileName={previewDoc.fileName}
          mimeType={previewDoc.mimeType}
          previewUrl={previewDoc.previewUrl}
          onClose={() => setPreviewDoc(null)}
        />
      )}

      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Upload Personal Document</h2>
            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  File <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/jpg"
                  onChange={handleFileSelect}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">Max 10MB, PDF/JPG/PNG</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Document Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={uploadData.documentType}
                  onChange={(e) => setUploadData({ ...uploadData, documentType: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {PERSONAL_DOC_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Document Number</label>
                <input
                  type="text"
                  value={uploadData.documentNumber}
                  onChange={(e) => setUploadData({ ...uploadData, documentNumber: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g. NIK / NPWP / BPJS / SIM number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Expiry Date (if applicable)</label>
                <input
                  type="date"
                  value={uploadData.endDate}
                  onChange={(e) => setUploadData({ ...uploadData, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={uploadData.notes}
                  onChange={(e) => setUploadData({ ...uploadData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Optional notes..."
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  disabled={uploading}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
