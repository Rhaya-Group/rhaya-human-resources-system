// frontend/src/utils/documentTypes.js
// Shared document-type config used by FilesTab (HR) and MyPersonalDocuments (employee self-service)

export const CONTRACT_TYPES = [
  { value: 'PKWT', label: 'PKWT (Fixed-term Contract)' },
  { value: 'PKWTT', label: 'PKWTT (Permanent Contract)' },
  { value: 'Internship', label: 'Internship Agreement' },
  { value: 'Amendment', label: 'Contract Amendment' },
  { value: 'LoA', label: 'Letter of Appointment' },
];

// Contract types that define the employee's current contract period — upload
// syncs User.contractStartDate/contractEndDate (see document.controller.js).
// LoA/Internship are excluded since they don't represent an ongoing period.
export const CONTRACT_PERIOD_TYPES = ['PKWT', 'PKWTT', 'Amendment'];

export const PERSONAL_DOC_TYPES = [
  { value: 'KTP', label: 'KTP (National ID)' },
  { value: 'NPWP', label: 'NPWP (Tax ID)' },
  { value: 'BPJS_Kesehatan', label: 'BPJS Kesehatan' },
  { value: 'BPJS_TK', label: 'BPJS Ketenagakerjaan' },
  { value: 'SIM', label: 'SIM (Driving License)' },
  { value: 'KK', label: 'KK (Family Card)' },
];

export const PERSONAL_TYPE_VALUES = PERSONAL_DOC_TYPES.map((t) => t.value);

export const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

const TYPE_BADGE_COLORS = {
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
  KK: 'bg-lime-100 text-lime-800',
};

export const getTypeBadge = (type) => TYPE_BADGE_COLORS[type] || 'bg-gray-100 text-gray-800';

export const getStatusBadge = (status) => {
  const colors = {
    active: 'bg-green-100 text-green-800',
    expired: 'bg-red-100 text-red-800',
    superseded: 'bg-gray-100 text-gray-800',
  };
  return colors[status] || colors.active;
};

export const formatDate = (date) =>
  date ? new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

export const formatFileSize = (bytes) => (bytes / 1024).toFixed(1) + ' KB';

const EXPIRY_WARNING_DAYS = 30;

// Returns null if no endDate, otherwise { label, className } describing expiry state.
export const getExpiryInfo = (endDate) => {
  if (!endDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((end - today) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) {
    return { label: `Expired ${Math.abs(daysLeft)}d ago`, className: 'bg-red-100 text-red-800', daysLeft };
  }
  if (daysLeft <= EXPIRY_WARNING_DAYS) {
    return { label: `Expires in ${daysLeft}d`, className: 'bg-amber-100 text-amber-800', daysLeft };
  }
  return null;
};

export const isPreviewable = (mimeType) => ALLOWED_FILE_TYPES.includes(mimeType);
