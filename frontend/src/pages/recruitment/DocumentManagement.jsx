// Epic C9: Document management (issue outbound, view inbound submissions)
// - GET /api/recruitment/documents?applicationId=
// - POST /api/recruitment/documents (multipart/form-data or JSON for links)
// - DELETE /api/recruitment/documents/:id
// TODO: implement

import RecruitmentDocumentList from "./RecruitmentDocumentList.jsx";

export default function DocumentManagement() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Document Management</h1>
      <RecruitmentDocumentList documents={[]} />
    </div>
  );
}
