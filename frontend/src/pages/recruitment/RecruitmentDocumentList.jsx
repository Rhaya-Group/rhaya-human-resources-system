import { useState } from "react";
import DocumentPreviewModal from "../../components/DocumentPreviewModal.jsx";
import apiClient from "../../api/client";

function normalizeUrl(url) {
  if (!url) return "";
  if (/^(https?:|blob:|data:)/i.test(url) || url.startsWith("/")) return url;
  return `https://${url}`;
}

function isPdf(url) {
  return normalizeUrl(url).split("?")[0].toLowerCase().endsWith(".pdf");
}

export default function RecruitmentDocumentList({ title, documents = [], onDelete }) {
  const [preview, setPreview] = useState(null);
  const [loadingId, setLoadingId] = useState(null);

  async function view(doc) {
    setLoadingId(doc.id);
    try {
      const res = await apiClient.get(`/recruitment/documents/${doc.id}/view`, { responseType: "blob" });
      const href = URL.createObjectURL(res.data);
      setPreview({
        title: doc.title,
        href,
        mimeType: res.headers["content-type"] || "application/pdf",
      });
    } finally {
      setLoadingId(null);
    }
  }

  function closePreview() {
    if (preview?.href?.startsWith("blob:")) URL.revokeObjectURL(preview.href);
    setPreview(null);
  }

  return (
    <div>
      {title && <h4 className="text-xs font-semibold text-gray-500 mb-1">{title}</h4>}
      {documents.length === 0 ? (
        <p className="text-sm text-gray-400">No documents.</p>
      ) : (
        <ul className="space-y-1">
          {documents.map((doc) => {
            const href = normalizeUrl(doc.fileUrl || doc.linkUrl);
            return (
              <li key={doc.id} className="text-sm flex items-center justify-between gap-2 rounded border border-gray-100 px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-gray-800">{doc.title}</span>
                  <span className="text-xs text-gray-400">{doc.direction} · {doc.kind}{doc.stage ? ` · ${doc.stage}` : ""}</span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  {href && isPdf(href) && (
                    <button
                      type="button"
                      onClick={() => view(doc)}
                      className="text-blue-600 hover:underline"
                    >
                      {loadingId === doc.id ? "Loading..." : "View"}
                    </button>
                  )}
                  {href && (
                    <a href={href} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                      Open
                    </a>
                  )}
                  {onDelete && (
                    <button type="button" onClick={() => onDelete(doc)} className="text-red-600 hover:underline">
                      Delete
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {preview && (
        <DocumentPreviewModal
          fileName={preview.title}
          mimeType={preview.mimeType}
          previewUrl={preview.href}
          onClose={closePreview}
        />
      )}
    </div>
  );
}
