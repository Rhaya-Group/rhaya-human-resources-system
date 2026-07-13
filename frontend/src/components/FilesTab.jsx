// frontend/src/components/FilesTab.jsx
import { useState, useEffect } from 'react';
import apiClient from '../api/client';

const DOCUMENT_TYPES = [
  { value: 'PKWT', label: 'PKWT (Fixed-term Contract)' },
  { value: 'PKWTT', label: 'PKWTT (Permanent Contract)' },
  { value: 'Internship', label: 'Internship Agreement' },
  { value: 'Amendment', label: 'Contract Amendment' },
  { value: 'LoA', label: 'Letter of Appointment' },
  { value: 'KTP', label: 'KTP (National ID)' },
  { value: 'NPWP', label: 'NPWP (Tax ID)' },
  { value: 'BPJS_Kesehatan', label: 'BPJS Kesehatan' },
  { value: 'BPJS_TK', label: 'BPJS Ketenagakerjaan' },
  { value: 'SIM', label: 'SIM (Driving License)' },
  { value: 'KK', label: 'KK (Family Card)' },
  // Note: Payslip NOT in upload options - use Payslip Management
];

const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

export default function FilesTab({ userId, isAdmin }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingDocument, setEditingDocument] = useState(null);
  const [filterType, setFilterType] = useState('');

  const [uploadData, setUploadData] = useState({
    file: null,
    documentType: 'PKWT',
    startDate: '',
    endDate: '',
    notes: ''
  });

  const [editData, setEditData] = useState({
    fileName: '',
    documentType: '',
    startDate: '',
    endDate: '',
    status: '',
    notes: ''
  });

  useEffect(() => {
    fetchDocuments();
  }, [userId, filterType]);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const url = filterType 
        ? `/users/${userId}/documents?type=${filterType}`
        : `/users/${userId}/documents`;
      const res = await apiClient.get(url);
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
      setUploadData({...uploadData, file});
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
      if (uploadData.startDate) formData.append('startDate', uploadData.startDate);
      if (uploadData.endDate) formData.append('endDate', uploadData.endDate);
      if (uploadData.notes) formData.append('notes', uploadData.notes);

      await apiClient.post(`/users/${userId}/documents/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      alert('Document uploaded successfully!');
      setShowUploadModal(false);
      setUploadData({ file: null, documentType: 'PKWT', startDate: '', endDate: '', notes: '' });
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

  const openEditModal = (document) => {
    setEditingDocument(document);
    setEditData({
      fileName: document.fileName,
      documentType: document.documentType,
      startDate: document.startDate ? new Date(document.startDate).toISOString().split('T')[0] : '',
      endDate: document.endDate ? new Date(document.endDate).toISOString().split('T')[0] : '',
      status: document.status,
      notes: document.notes || ''
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

  const formatDate = (date) => date ? new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
  const formatFileSize = (bytes) => (bytes / 1024).toFixed(1) + ' KB';

  const getStatusBadge = (status) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      expired: 'bg-red-100 text-red-800',
      superseded: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || colors.active;
  };

  const getTypeBadge = (type) => {
    const colors = {
      PKWT: 'bg-blue-100 text-blue-800',
      PKWTT: 'bg-green-100 text-green-800',
      Internship: 'bg-purple-100 text-purple-800',
      Amendment: 'bg-yellow-100 text-yellow-800',
      LoA: 'bg-indigo-100 text-indigo-800',
      Payslip: 'bg-pink-100 text-pink-800',
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
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading files...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Filter */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Employee Files</h3>
            <p className="text-sm text-gray-600 mt-1">{documents.length} file(s) on record</p>
          </div>
          
          <div className="flex gap-3 w-full sm:w-auto">
            {/* Type Filter */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">All Types</option>
              {DOCUMENT_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
              <option value="Payslip">Payslip</option>
            </select>

            {isAdmin && (
              <button
                onClick={() => setShowUploadModal(true)}
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

      {/* Documents List */}
      {documents.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No files found</h3>
            <p className="text-gray-500">
              {filterType ? `No ${filterType} documents available` : 'Upload files to get started'}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
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
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <svg className="w-8 h-8 text-gray-400 mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{doc.fileName}</div>
                        <div className="text-xs text-gray-500">{formatFileSize(doc.fileSize)}</div>
                      </div>
                    </div>
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
                      </div>
                    ) : '-'}
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
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleDownload(doc.id, doc.fileName)}
                        className="text-blue-600 hover:text-blue-900"
                        title="Download"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => openEditModal(doc)}
                            className="text-green-600 hover:text-green-900"
                            title="Edit"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(doc.id, doc.fileName)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
                  onChange={(e) => setUploadData({...uploadData, documentType: e.target.value})}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {DOCUMENT_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={uploadData.startDate}
                    onChange={(e) => setUploadData({...uploadData, startDate: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                  <input
                    type="date"
                    value={uploadData.endDate}
                    onChange={(e) => setUploadData({...uploadData, endDate: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={uploadData.notes}
                  onChange={(e) => setUploadData({...uploadData, notes: e.target.value})}
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
                  onChange={(e) => setEditData({...editData, fileName: e.target.value})}
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
                  onChange={(e) => setEditData({...editData, documentType: e.target.value})}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  {DOCUMENT_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                  <option value="Payslip">Payslip</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                  <input
                    type="date"
                    value={editData.startDate}
                    onChange={(e) => setEditData({...editData, startDate: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                  <input
                    type="date"
                    value={editData.endDate}
                    onChange={(e) => setEditData({...editData, endDate: e.target.value})}
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
                  onChange={(e) => setEditData({...editData, status: e.target.value})}
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
                  onChange={(e) => setEditData({...editData, notes: e.target.value})}
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
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
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