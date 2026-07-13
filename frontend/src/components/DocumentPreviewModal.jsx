// frontend/src/components/DocumentPreviewModal.jsx
// Inline preview for PDF/image documents using a signed download URL.

export default function DocumentPreviewModal({ fileName, mimeType, previewUrl, onClose }) {
  const isImage = mimeType?.startsWith('image/');
  const isPdf = mimeType === 'application/pdf';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-3xl h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-sm font-medium text-gray-900 truncate pr-4">{fileName}</h3>
          <div className="flex items-center gap-3 flex-shrink-0">
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Open in new tab
            </a>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-gray-100">
          {isImage && (
            <img src={previewUrl} alt={fileName} className="max-w-full max-h-full mx-auto object-contain" />
          )}
          {isPdf && <iframe src={previewUrl} title={fileName} className="w-full h-full border-0" />}
          {!isImage && !isPdf && (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
              Preview not available for this file type. Use "Open in new tab" to view.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
