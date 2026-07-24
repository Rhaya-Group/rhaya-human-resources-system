import { useMemo, useState } from "react";

export default function UserPicker({ users, value, onChange, excludeIds = [], placeholder = "Select user..." }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const excluded = new Set(excludeIds);
  const selected = users.find((user) => user.id === value);
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users
      .filter((user) => !excluded.has(user.id) || user.id === value)
      .filter((user) => !q || `${user.name || ""} ${user.email || ""}`.toLowerCase().includes(q));
  }, [users, excluded, search, value]);

  function label(user) {
    if (!user) return "";
    return `${user.name || user.email}${user.email && user.name ? ` (${user.email})` : ""}`;
  }

  return (
    <div className="relative">
      <input
        value={open ? search : label(selected)}
        onFocus={() => { setOpen(true); setSearch(""); }}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
      />
      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded border border-gray-200 bg-white shadow-lg">
          <button
            type="button"
            onMouseDown={() => onChange("")}
            className="block w-full px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50"
          >
            {placeholder}
          </button>
          {filteredUsers.map((user) => (
            <button
              key={user.id}
              type="button"
              onMouseDown={() => onChange(user.id)}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
            >
              <span className="font-medium text-gray-900">{user.name || user.email}</span>
              {user.email && user.name && <span className="block text-xs text-gray-500">{user.email}</span>}
            </button>
          ))}
          {filteredUsers.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-500">No users found.</p>
          )}
        </div>
      )}
    </div>
  );
}
