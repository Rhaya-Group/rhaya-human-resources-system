export default function RecruitmentDocumentList({ title, documents = [] }) {
  return (
    <div>
      {title && <h4 className="text-xs font-semibold text-gray-500 mb-1">{title}</h4>}
      {documents.length === 0 ? (
        <p className="text-sm text-gray-400">No documents.</p>
      ) : (
        <ul className="space-y-1">
          {documents.map((doc) => {
            const href = doc.fileUrl || doc.linkUrl;
            return (
              <li key={doc.id} className="text-sm flex items-center justify-between gap-2">
                <span className="truncate">{doc.title}</span>
                {href && (
                  <a href={href} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline shrink-0">
                    Open
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
