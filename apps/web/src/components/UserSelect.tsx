import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchUsers } from "../lib/api";
import type { UserProfile } from "../types";

interface UserSelectProps {
  value: string;
  onChange: (userId: string) => void;
  disabled?: boolean;
}

const UserSelect = ({ value, onChange, disabled }: UserSelectProps) => {
  const [search, setSearch] = useState("");
  const [selectedLabel, setSelectedLabel] = useState<string>("");
  const { data, refetch, isFetching } = useQuery({
    queryKey: ["user-search", search],
    queryFn: () => (search.length ? searchUsers(search) : Promise.resolve({ users: [] })),
    enabled: false
  });

  const users = data?.users ?? [];

  const handleSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const userId = event.target.value;
    onChange(userId);
    const label = users.find((user) => user.userId === userId)?.displayName ?? userId;
    setSelectedLabel(label);
  };

  return (
    <div className="user-select">
      <div className="input-group">
        <label htmlFor="user-search">Search for a person</label>
        <div className="user-search-row">
          <input
            id="user-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            disabled={disabled}
            placeholder="Start typing a name or email"
          />
          <button type="button" onClick={() => refetch()} disabled={disabled || !search.trim()}>
            {isFetching ? "Searching…" : "Search"}
          </button>
        </div>
      </div>
      {users.length > 0 && (
        <div className="input-group">
          <label htmlFor="user-select">Select user</label>
          <select id="user-select" value={value} onChange={handleSelect} disabled={disabled}>
            <option value="">Choose person…</option>
            {users.map((user: UserProfile) => (
              <option key={user.userId} value={user.userId}>
                {user.displayName ?? user.email ?? user.userId}
              </option>
            ))}
          </select>
        </div>
      )}
      {value && selectedLabel && (
        <p className="muted" style={{ margin: 0 }}>
          Selected: {selectedLabel}
        </p>
      )}
    </div>
  );
};

export default UserSelect;
