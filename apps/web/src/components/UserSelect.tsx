import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchUsers } from "../lib/api";
import type { UserProfile } from "../types";

interface UserSelectProps {
  value: string;
  onChange: (userId: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

const useDebounce = <T,>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
};

const formatUserOption = (user: UserProfile): string => {
  const name = user.displayName;
  const email = user.email;
  if (name && email) {
    return `${name} (${email})`;
  }
  return name ?? email ?? user.userId;
};

const UserSelect = ({ value, onChange, disabled, placeholder }: UserSelectProps) => {
  const [search, setSearch] = useState("");
  const [selectedLabel, setSelectedLabel] = useState<string>("");
  const debouncedSearch = useDebounce(search, 300);

  const { data, isFetching } = useQuery({
    queryKey: ["user-search", debouncedSearch],
    queryFn: () => searchUsers(debouncedSearch),
    enabled: debouncedSearch.length >= 2
  });

  const users = data?.users ?? [];

  const handleSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const userId = event.target.value;
    onChange(userId);
    const user = users.find((u) => u.userId === userId);
    if (user) {
      setSelectedLabel(formatUserOption(user));
    } else {
      setSelectedLabel("");
    }
  };

  const handleClear = () => {
    onChange("");
    setSelectedLabel("");
    setSearch("");
  };

  return (
    <div className="user-select">
      {value && selectedLabel ? (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span className="pill">{selectedLabel}</span>
          <button
            type="button"
            className="secondary"
            style={{ padding: "0.25rem 0.6rem", fontSize: "0.8rem" }}
            onClick={handleClear}
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            disabled={disabled}
            placeholder={placeholder ?? "Start typing a name or email"}
          />
          {isFetching && (
            <p className="muted" style={{ margin: "0.5rem 0 0", fontSize: "0.85rem" }}>
              Searching...
            </p>
          )}
          {!isFetching && debouncedSearch.length >= 2 && users.length === 0 && (
            <p className="muted" style={{ margin: "0.5rem 0 0", fontSize: "0.85rem" }}>
              No users found
            </p>
          )}
          {users.length > 0 && (
            <select
              value={value}
              onChange={handleSelect}
              disabled={disabled}
              style={{ marginTop: "0.5rem" }}
            >
              <option value="">Select a person...</option>
              {users.map((user: UserProfile) => (
                <option key={user.userId} value={user.userId}>
                  {formatUserOption(user)}
                </option>
              ))}
            </select>
          )}
        </>
      )}
    </div>
  );
};

export default UserSelect;
