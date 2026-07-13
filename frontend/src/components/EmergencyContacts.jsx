// frontend/src/components/EmergencyContacts.jsx
// Emergency contact list: name, relationship, phone.
// canEdit=true (own profile) allows add/edit/delete; false renders read-only (HR viewing an employee).

import { useState, useEffect } from 'react';
import apiClient from '../api/client';

// variant "card": rounded-3xl subtle-shadow theme used on the employee's own
//   Profile page (matches Personal Info / Employment / Security sections there).
// variant "plain": bg-white rounded-lg + border-b header used on HR's
//   UserDetail overview tab (matches Personal Info / Employment Info there).
export default function EmergencyContacts({ userId, canEdit = false, variant = 'card' }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [formData, setFormData] = useState({ name: '', relationship: '', phone: '' });

  useEffect(() => {
    fetchContacts();
  }, [userId]);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/users/${userId}/emergency-contacts`);
      setContacts(res.data.data || []);
    } catch (error) {
      console.error('Fetch emergency contacts error:', error);
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditingContact(null);
    setFormData({ name: '', relationship: '', phone: '' });
    setShowModal(true);
  };

  const openEditModal = (contact) => {
    setEditingContact(contact);
    setFormData({ name: contact.name, relationship: contact.relationship, phone: contact.phone });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      if (editingContact) {
        await apiClient.put(`/users/${userId}/emergency-contacts/${editingContact.id}`, formData);
      } else {
        await apiClient.post(`/users/${userId}/emergency-contacts`, formData);
      }
      setShowModal(false);
      fetchContacts();
    } catch (error) {
      console.error('Save emergency contact error:', error);
      alert(error.response?.data?.error || 'Failed to save emergency contact');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (contactId, name) => {
    if (!confirm(`Remove emergency contact: ${name}?`)) return;
    try {
      await apiClient.delete(`/users/${userId}/emergency-contacts/${contactId}`);
      fetchContacts();
    } catch (error) {
      console.error('Delete emergency contact error:', error);
      alert(error.response?.data?.error || 'Failed to delete emergency contact');
    }
  };

  const icon = (
    <svg className={variant === 'card' ? 'w-[18px] h-[18px]' : 'w-5 h-5 mr-2'} fill="currentColor" viewBox="0 0 24 24">
      <path d="M17.25 12h1.5v-1.7l1.475.85l.75-1.3L19.5 9l1.475-.85l-.75-1.3l-1.475.85V6h-1.5v1.7l-1.475-.85l-.75 1.3L16.5 9l-1.475.85l.75 1.3l1.475-.85zM2 21q-.825 0-1.412-.587T0 19V5q0-.825.588-1.412T2 3h20q.825 0 1.413.588T24 5v14q0 .825-.587 1.413T22 21zm13.9-2H22V5H2v14h.1q1.05-1.875 2.9-2.937T9 15t4 1.063T15.9 19m-4.775-5.875Q12 12.25 12 11t-.875-2.125T9 8t-2.125.875T6 11t.875 2.125T9 14t2.125-.875M4.55 19h8.9q-.85-.95-2.013-1.475T9 17t-2.425.525T4.55 19m3.737-7.288Q8 11.425 8 11t.288-.712T9 10t.713.288T10 11t-.288.713T9 12t-.712-.288M12 12" />
    </svg>
  );

  const addButton = canEdit && (
    <button
      onClick={openAddModal}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center whitespace-nowrap text-sm"
    >
      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
      Add Contact
    </button>
  );

  const wrapperClass =
    variant === 'card'
      ? 'bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 overflow-hidden'
      : 'bg-white rounded-lg shadow p-6';

  const header =
    variant === 'card' ? (
      <div className="px-6 py-4 border-b border-gray-50 flex justify-between items-center">
        <div className="flex items-center space-x-2 text-gray-400">
          {icon}
          <h3 className="text-xs font-black uppercase tracking-widest">Emergency Contacts</h3>
        </div>
        {addButton}
      </div>
    ) : (
      <div className="flex justify-between items-center mb-4 border-b pb-2">
        <h3 className="font-semibold text-gray-900 flex items-center">
          {icon}
          Emergency Contacts
        </h3>
        {addButton}
      </div>
    );

  const body = (
    <>
      {loading ? (
        <div className="text-center py-6 text-gray-500 text-sm">Loading...</div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-6 text-gray-500 text-sm">No emergency contacts on record</div>
      ) : (
        <div className="space-y-3">
          {contacts.map((contact) => (
            <div key={contact.id} className="border border-gray-200 rounded-lg p-4 flex items-start justify-between">
              <div>
                <p className="font-medium text-gray-900">{contact.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{contact.relationship}</p>
                <p className="text-sm text-gray-700 mt-1">{contact.phone}</p>
              </div>
              {canEdit && (
                <div className="flex items-center gap-3 flex-shrink-0">
                  <button onClick={() => openEditModal(contact)} className="text-green-600 hover:text-green-900" title="Edit">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onClick={() => handleDelete(contact.id, contact.name)} className="text-red-600 hover:text-red-900" title="Delete">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingContact ? 'Edit Emergency Contact' : 'Add Emergency Contact'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="Full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Relationship <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.relationship}
                  onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g. Spouse, Parent, Sibling"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  placeholder="e.g. 08123456789"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingContact ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className={wrapperClass}>
      {header}
      {variant === 'card' ? <div className="p-6">{body}</div> : body}
    </div>
  );
}
