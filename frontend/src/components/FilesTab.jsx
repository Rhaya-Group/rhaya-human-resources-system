// frontend/src/components/FilesTab.jsx
import { useState, useEffect, Fragment } from 'react';
import apiClient from '../api/client';
import DocumentPreviewModal from './DocumentPreviewModal';
import {
  CONTRACT_TYPES,
  PERSONAL_DOC_TYPES,
  PERSONAL_TYPE_VALUES,
  ALLOWED_FILE_TYPES,
  getTypeBadge,
  getStatusBadge,
  getExpiryInfo,
  formatDate,
  formatFileSize,
  isPreviewable,
} from '../utils/documentTypes';

function FileCell({ doc }) {
  return (
    <div className="flex items-center">
      <svg className="w-8 h-8 text-gray-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
      </svg>
      <div>
        <div className="text-sm font-medium text-gray-900">{doc.fileName}</div>
        <div className="text-xs text-gray-500">{formatFileSize(doc.fileSize)}</div>
      </div>
    </div>
  );
}

function RowActions({ doc, isAdmin, onPreview, onDownload, onEdit, onDelete }) {
  return (
    <div className="flex space-x-2">
      {isPreviewable(doc.mimeType) && (
        <button onClick={() => onPreview(doc)} className="text-gray-500 hover:text-gray-800" title="Preview">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </button>
      )}
      <button onClick={() => onDownload(doc.id, doc.fileName)} className="text-blue-600 hover:text-blue-900" title="Download">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </button>
      {isAdmin && (
        <>
          <button onClick={() => onEdit(doc)} className="text-green-600 hover:text-green-900" title="Edit">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button onClick={() => onDelete(doc.id, doc.fileName)} className="text-red-600 hover:text-red-900" title="Delete">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </>
      )}
    </div>
  );
}

// Flat table used for Contracts (no version grouping — amendments legitimately
// coexist alongside the base contract, so grouping by type would be misleading).
function ContractTable({ documents, isAdmin, onPreview, onDownload, onEdit, onDelete, emptyLabel }) {
  if (documents.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-10">
          <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-500">{emptyLabel}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">File Name</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uploaded</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {documents.map((doc) => {
            const expiry = getExpiryInfo(doc.endDate);
            return (
              <tr key={doc.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <FileCell doc={doc} />
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeBadge(doc.documentType)}`}>
                    {doc.documentType}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {doc.startDate && doc.endDate ? (
                    <div>
                      <div>{formatDate(doc.startDate)}</div>
                      <div className="text-xs text-gray-500">to {formatDate(doc.endDate)}</div>
                      {expiry && (
                        <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full ${expiry.className}`}>
                          {expiry.label}
                        </span>
                      )}
                    </div>
                  ) : (
                    '-'
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(doc.status)}`}>
                    {doc.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  <div>{formatDate(doc.uploadedAt)}</div>
                  <div className="text-xs">by {doc.uploadedBy.name}</div>
                </td>
                <td className="px-6 py-4 text-sm font-medium">
                  <RowActions doc={doc} isAdmin={isAdmin} onPreview={onPreview} onDownload={onDownload} onEdit={onEdit} onDelete={onDelete} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Grouped view for Personal Documents: one row per document type showing the
// latest upload, with older re-uploads collapsed behind a toggle.
function PersonalDocGroups({ documents, isAdmin, onPreview, onDownload, onEdit, onDelete, emptyLabel }) {
  const [expanded, setExpanded] = useState({});

  if (documents.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-10">
          <svg className="w-12 h-12 mx-auto text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-500">{emptyLabel}</p>
        </div>
      </div>
    );
  }

  const groups = {};
  documents.forEach((doc) => {
    if (!groups[doc.documentType]) groups[doc.documentType] = [];
    groups[doc.documentType].push(doc);
  });
  Object.values(groups).forEach((docs) => docs.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)));

  const renderRow = (doc, isHistory) => {
    const expiry = getExpiryInfo(doc.endDate);
    return (
      <tr key={doc.id} className={`hover:bg-gray-50 ${isHistory ? 'bg-gray-50/50' : ''}`}>
        <td className="px-6 py-4">
          <div className={isHistory ? 'pl-8' : ''}>
            <FileCell doc={doc} />
          </div>
        </td>
        <td className="px-6 py-4">
          {!isHistory && (
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${getTypeBadge(doc.documentType)}`}>
              {doc.documentType}
            </span>
          )}
        </td>
        <td className="px-6 py-4 text-sm text-gray-900">
          <div>{doc.documentNumber || '-'}</div>
          {expiry && (
            <span className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full ${expiry.className}`}>
              {expiry.label}
            </span>
          )}
        </td>
        <td className="px-6 py-4">
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(doc.status)}`}>
            {doc.status}
          </span>
        </td>
        <td className="px-6 py-4 text-sm text-gray-500">
          <div>{formatDate(doc.uploadedAt)}</div>
          <div className="text-xs">by {doc.uploadedBy.name}</div>
        </td>
        <td className="px-6 py-4 text-sm font-medium">
          <RowActions doc={doc} isAdmin={isAdmin} onPreview={onPreview} onDownload={onDownload} onEdit={onEdit} onDelete={onDelete} />
        </td>
      </tr>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">File Name</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Document Number</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Uploaded</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {Object.entries(groups).map(([type, docs]) => {
            const [current, ...history] = docs;
            const isExpanded = !!expanded[type];
            return (
              <Fragment key={type}>
                {renderRow(current, false)}
                {history.length > 0 && (
                  <tr key={`${type}-toggle`} className="bg-white">
                    <td colSpan={6} className="px-6 py-2">
                      <button
                        onClick={() => setExpanded({ ...expanded, [type]: !isExpanded })}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {isExpanded ? '▾ Hide' : '▸ Show'} {history.length} older version{history.length > 1 ? 's' : ''}
                      </button>
                    </td>
                  </tr>
                )}
                {isExpanded && history.map((doc) => renderRow(doc, true))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function FilesTab({ userId, isAdmin }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingDocument, setEditingDocument] = useState(null);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [contractFilterType, setContractFilterType] = useState('');
  const [personalFilterType, setPersonalFilterType] = useState('');

  const [uploadData, setUploadData] = useState({
    file: null,
    documentType: 'PKWT',
    documentNumber: '',
    startDate: '',
    endDate: '',
    notes: '',
  });

  const [editData, setEditData] = useState({
    fileName: '',
    documentType: '',
    documentNumber: '',
    startDate: '',
    endDate: '',
    status: '',
    notes: '',
  });

  useEffect(() => {
    fetchDocuments();
  }, [userId]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/users/${userId}/documents`);
      setDocuments(res.data.data || []);
    } catch (error) {
      console.error('Fetch documents error:', error);
      alert('Failed to load documents');
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
      if (uploadData.startDate) formData.append('startDate', uploadData.startDate);
      if (uploadData.endDate) formData.append('endDate', uploadData.endDate);
      if (uploadData.notes) formData.append('notes', uploadData.notes);

      await apiClient.post(`/users/${userId}/documents/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      alert('Document uploaded successfully!');
      setShowUploadModal(false);
      setUploadData({ file: null, documentType: 'PKWT', documentNumber: '', startDate: '', endDate: '', notes: '' });
      fetchDocuments();
    } catch (error) {
      console.error('Upload error:', error);
      alert(error.response?.data?.error || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (documentId, fileName) => {
    try {
      const res = await apiClient.get(`/users/${userId}/documents/${documentId}/download`);
      const { downloadUrl } = res.data.data;
      window.open(downloadUrl, '_blank');
    } catch (error) {
      console.error('Download error:', error);
      alert(error.response?.data?.error || 'Failed to download document');
    }
  };

  const handlePreview = async (doc) => {
    try {
      const res = await apiClient.get(`/users/${userId}/documents/${doc.id}/download`);
      setPreviewDoc({ ...doc, previewUrl: res.data.data.downloadUrl });
    } catch (error) {
      console.error('Preview error:', error);
      alert(error.response?.data?.error || 'Failed to load preview');
    }
  };

  const openEditModal = (document) => {
    setEditingDocument(document);
    setEditData({
      fileName: document.fileName,
      documentType: document.documentType,
      documentNumber: document.documentNumber || '',
      startDate: document.startDate ? new Date(document.startDate).toISOString().split('T')[0] : '',
      endDate: document.endDate ? new Date(document.endDate).toISOString().split('T')[0] : '',
      status: document.status,
      notes: document.notes || '',
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await apiClient.put(`/users/${userId}/documents/${editingDocument.id}`, editData);
      alert('Document updated successfully!');
      setShowEditModal(false);
      setEditingDocument(null);
      fetchDocuments();
    } catch (error) {
      console.error('Update error:', error);
      alert(error.response?.data?.error || 'Failed to update document');
    }
  };

  const handleDelete = async (documentId, fileName) => {
    if (!confirm(`Delete document: ${fileName}?`)) return;

    try {
      await apiClient.delete(`/users/${userId}/documents/${documentId}`);
      alert('Document deleted successfully');
      fetchDocuments();
    } catch (error) {
      console.error('Delete error:', error);
      alert(error.response?.data?.error || 'Failed to delete document');
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading files...</p>
        </div>
      </div>
    );
  }

  const contractDocs = documents
    .filter((d) => !PERSONAL_TYPE_VALUES.includes(d.documentType))
    .filter((d) => !contractFilterType || d.documentType === contractFilterType);

  const personalDocs = documents
    .filter((d) => PERSONAL_TYPE_VALUES.includes(d.documentType))
    .filter((d) => !personalFilterType || d.documentType === personalFilterType);

  const isPersonalTypeSelected = PERSONAL_TYPE_VALUES.includes(uploadData.documentType);
  const isEditPersonalTypeSelected = PERSONAL_TYPE_VALUES.includes(editData.documentType);

  return (
    <div className="space-y-8">
      {/* Contracts Section */}
      <div className="space-y-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Contracts</h3>
              <p className="text-sm text-gray-600 mt-1">{contractDocs.length} file(s) on record</p>
            </div>

            <div className="flex gap-3 w-full sm:w-auto">
              <select
                value={contractFilterType}
                onChange={(e) => setContractFilterType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">All Contract Types</option>
                {CONTRACT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>

              {isAdmin && (
                <button
                  onClick={() => {
                    setUploadData({ ...uploadData, documentType: 'PKWT' });
                    setShowUploadModal(true);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center whitespace-nowrap"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload File
                </button>
              )}
            </div>
          </div>
        </div>

        <ContractTable
          documents={contractDocs}
          isAdmin={isAdmin}
          onPreview={handlePreview}
          onDownload={handleDownload}
          onEdit={openEditModal}
          onDelete={handleDelete}
          emptyLabel={contractFilterType ? `No ${contractFilterType} documents available` : 'No contract files on record'}
        />
      </div>

      {/* Personal Documents Section */}
      <div className="space-y-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Personal Documents</h3>
              <p className="text-sm text-gray-600 mt-1">{personalDocs.length} file(s) on record</p>
            </div>

            <div className="flex gap-3 w-full sm:w-auto">
              <select
                value={personalFilterType}
                onChange={(e) => setPersonalFilterType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">All Personal Doc Types</option>
                {PERSONAL_DOC_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>

              {isAdmin && (
                <button
                  onClick={() => {
                    setUploadData({ ...uploadData, documentType: 'KTP' });
                    setShowUploadModal(true);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center whitespace-nowrap"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload File
                </button>
              )}
            </div>
          </div>
        </div>

        <PersonalDocGroups
          documents={personalDocs}
          isAdmin={isAdmin}
          onPreview={handlePreview}
          onDownload={handleDownload}
          onEdit={openEditModal}
          onDelete={handleDelete}
          emptyLabel={
            personalFilterType ? `No ${personalFilterType} documents available` : 'No personal documents on record'
          }
        />
      </div>

      {/* Preview Modal */}
      {previewDoc && (
        <DocumentPreviewModal
          fileName={previewDoc.fileName}
          mimeType={previewDoc.mimeType}
          previewUrl={previewDoc.previewUrl}
          onClose={() => setPreviewDoc(null)}
        />
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Upload Document</h2>
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
                  <optgroup label="Contracts">
                    {CONTRACT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Personal Documents">
                    {PERSONAL_DOC_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {isPersonalTypeSelected && (
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
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={uploadData.startDate}
                    onChange={(e) => setUploadData({ ...uploadData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {isPersonalTypeSelected ? 'Expiry Date' : 'End Date'}
                  </label>
                  <input
                    type="date"
                    value={uploadData.endDate}
                    onChange={(e) => setUploadData({ ...uploadData, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={uploadData.notes}
                  onChange={(e) => setUploadData({ ...uploadData, notes: e.target.value })}
                  rows={3}
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

      {/* Edit Modal */}
      {showEditModal && editingDocument && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Edit Document</h2>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  File Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editData.fileName}
                  onChange={(e) => setEditData({ ...editData, fileName: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Document.pdf"
                />
                <p className="text-xs text-gray-500 mt-1">Change the display name (actual file remains unchanged)</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Document Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={editData.documentType}
                  onChange={(e) => setEditData({ ...editData, documentType: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <optgroup label="Contracts">
                    {CONTRACT_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Personal Documents">
                    {PERSONAL_DOC_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </optgroup>
                  <option value="Payslip">Payslip</option>
                </select>
              </div>

              {isEditPersonalTypeSelected && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Document Number</label>
                  <input
                    type="text"
                    value={editData.documentNumber}
                    onChange={(e) => setEditData({ ...editData, documentNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="e.g. NIK / NPWP / BPJS / SIM number"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={editData.startDate}
                    onChange={(e) => setEditData({ ...editData, startDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {isEditPersonalTypeSelected ? 'Expiry Date' : 'End Date'}
                  </label>
                  <input
                    type="date"
                    value={editData.endDate}
                    onChange={(e) => setEditData({ ...editData, endDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status <span className="text-red-500">*</span>
                </label>
                <select
                  value={editData.status}
                  onChange={(e) => setEditData({ ...editData, status: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="active">Active</option>
                  <option value="expired">Expired</option>
                  <option value="superseded">Superseded</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={editData.notes}
                  onChange={(e) => setEditData({ ...editData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Optional notes..."
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingDocument(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
